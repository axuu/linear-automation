import { LinearClient } from "@linear/sdk";

// 默认配置
const DEFAULT_ARCHIVE_AFTER_DAYS = 30;
const PAGE_SIZE = 50;

function daysToRelativeDuration(days: number): string {
  const d = Math.max(1, Math.floor(days));
  return `-P${d}D`;
}

async function main() {
  console.log("Starting Linear archive job...");

  // 1. 校验 LINEAR_API_KEY
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("Error: Missing LINEAR_API_KEY environment variable");
    process.exit(1);
  }

  const linear = new LinearClient({ apiKey });

  // 2. 读取环境变量
  const daysStr = process.env.ARCHIVE_AFTER_DAYS;
  const archiveAfterDays =
    daysStr && !Number.isNaN(Number(daysStr))
      ? Number(daysStr)
      : DEFAULT_ARCHIVE_AFTER_DAYS;

  const teamKey = process.env.LINEAR_TEAM_KEY;
  const dryRun = process.env.DRY_RUN !== "false"; // Default to dry-run true for safety in CLI unless explicitly set to false

  console.log(`Configuration:`);
  console.log(`- Archive items closed more than ${archiveAfterDays} days ago`);
  console.log(`- Team filter: ${teamKey || "None (All teams)"}`);
  console.log(`- Dry run: ${dryRun} (Set DRY_RUN=false to execute)`);

  const relativeDuration = daysToRelativeDuration(archiveAfterDays);

  // 3. 构造 Filter
  const filter: any = {
    completedAt: {
      lt: relativeDuration,
    },
  };

  if (teamKey) {
    filter.team = {
      key: {
        eq: teamKey,
      },
    };
  }

  // 4. 执行
  let afterCursor: string | undefined = undefined;
  let totalCandidates = 0;
  let archivedCount = 0;

  try {
    while (true) {
      process.stdout.write("."); // Progress indicator

      // In dry-run, we paginate normally.
      // In execute mode, we archive items which removes them from the list,
      // so we always fetch the first page again.
      const cursorToUse = dryRun ? afterCursor : undefined;

      const issuesConnection = await linear.issues({
        first: PAGE_SIZE,
        after: cursorToUse,
        filter,
      });

      const nodes = issuesConnection.nodes;
      if (!nodes.length) {
        break;
      }

      totalCandidates += nodes.length;

      for (const issue of nodes) {
        if (!issue.id) continue;

        if (dryRun) {
          console.log(
            `[Dry Run] Would archive: ${issue.identifier} - ${issue.title}`
          );
        } else {
          await linear.archiveIssue(issue.id);
          console.log(`[Archived] ${issue.identifier} - ${issue.title}`);
          archivedCount += 1;
        }
      }

      if (dryRun) {
        if (!issuesConnection.pageInfo.hasNextPage) {
          break;
        }
        afterCursor = issuesConnection.pageInfo.endCursor || undefined;
      } else {
        // If we processed a partial page, we are done.
        if (nodes.length < PAGE_SIZE) {
          break;
        }
        // Otherwise loop again to fetch the next batch (which is now at the start)
      }
    }

    console.log("\nDone!");
    console.log(`Total candidates found: ${totalCandidates}`);
    console.log(`Total archived: ${archivedCount}`);
  } catch (error: any) {
    console.error("\nError executing archive job:", error);
    process.exit(1);
  }
}

main();
