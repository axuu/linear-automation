// api/linear-archive.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LinearClient } from "@linear/sdk";
import { runArchiveJob } from "../lib/archive-service";

// 默认配置
const DEFAULT_ARCHIVE_AFTER_DAYS = 14;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 校验 CRON_SECRET（防止路由被外部乱调）
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers["authorization"];
      const expected = `Bearer ${cronSecret} `;
      if (authHeader !== expected) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    // 2. 校验 LINEAR_API_KEY
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing LINEAR_API_KEY environment variable",
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

    // 4. 执行归档任务
    const result = await runArchiveJob({
      client: linear,
      archiveAfterDays,
      teamKey,
      dryRun,
    });

    return res.status(200).json({
      ok: true,
      mode: dryRun ? "dry-run" : "archive",
      archiveAfterDays,
      teamKey: teamKey || null,
      totalCandidates: result.totalCandidates,
      archivedCount: result.archivedCount,
      preview:
        dryRun && result.previewIssues.length > 0
          ? result.previewIssues.slice(0, 20) // 预览前 20 个
          : [],
    });
  } catch (error: any) {
    console.error("[linear-archive] error", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Unknown error",
    });
  }
}
