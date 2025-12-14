// api/linear-archive.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LinearClient } from "@linear/sdk";

// 默认配置
const DEFAULT_ARCHIVE_AFTER_DAYS = 30;
const PAGE_SIZE = 50;

function daysToRelativeDuration(days: number): string {
  // Linear 支持 ISO-8601 相对时间，例如 "-P2W"（过去两周）:contentReference[oaicite:5]{index=5}
  // 这里用天数: "-P{n}D"
  const d = Math.max(1, Math.floor(days));
  return `-P${d}D`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // 1. 校验 CRON_SECRET（防止路由被外部乱调）:contentReference[oaicite:6]{index=6}
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers["authorization"];
      const expected = `Bearer ${cronSecret}`;
      if (authHeader !== expected) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    // 2. 校验 LINEAR_API_KEY
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing LINEAR_API_KEY environment variable"
      });
    }

    const linear = new LinearClient({ apiKey });

    // 3. 读取环境变量：归档天数、team 过滤、dry-run 等
    const daysStr = process.env.ARCHIVE_AFTER_DAYS;
    const archiveAfterDays =
      daysStr && !Number.isNaN(Number(daysStr))
        ? Number(daysStr)
        : DEFAULT_ARCHIVE_AFTER_DAYS;

    const teamKey = process.env.LINEAR_TEAM_KEY; // 可选：只处理某个 team
    const dryRun = process.env.DRY_RUN === "true";

    const relativeDuration = daysToRelativeDuration(archiveAfterDays);

    // 4. 构造 IssueFilter
    //    completedAt < -P{days}D  => 完成时间早于 {days} 天前:contentReference[oaicite:7]{index=7}
    const filter: any = {
      completedAt: {
        lt: relativeDuration
      }
    };

    if (teamKey) {
      // team.key == LINEAR_TEAM_KEY
      filter.team = {
        key: {
          eq: teamKey
        }
      };
    }

    // 5. 分页拉取 issue 并归档
    let afterCursor: string | undefined = undefined;
    let totalCandidates = 0;
    let archivedCount = 0;
    const previewIssues: Array<{
      id: string;
      identifier: string;
      title: string;
      url: string;
    }> = [];

    // 用 issues(...) 而不是 searchIssues(...)，直接传 filter + paginate:contentReference[oaicite:8]{index=8}
    while (true) {
      const issuesConnection = await linear.issues({
        first: PAGE_SIZE,
        after: afterCursor,
        filter
      });

      const nodes = issuesConnection.nodes;
      if (!nodes.length) {
        break;
      }

      totalCandidates += nodes.length;

      for (const issue of nodes) {
        // 防御：确保存 id 存在
        if (!issue.id) continue;

        if (dryRun) {
          previewIssues.push({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            url: issue.url
          });
        } else {
          // 真正执行归档操作
          await linear.archiveIssue(issue.id);
          archivedCount += 1;
        }
      }

      if (!issuesConnection.pageInfo.hasNextPage) {
        break;
      }

      afterCursor = issuesConnection.pageInfo.endCursor || undefined;
    }

    return res.status(200).json({
      ok: true,
      mode: dryRun ? "dry-run" : "archive",
      archiveAfterDays,
      teamKey: teamKey || null,
      totalCandidates,
      archivedCount,
      preview:
        dryRun && previewIssues.length > 0
          ? previewIssues.slice(0, 20) // 预览前 20 个，避免响应过大
          : []
    });
  } catch (error: any) {
    console.error("[linear-archive] error", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unknown error"
    });
  }
}
