import "dotenv/config";
import { LinearClient } from "@linear/sdk";
import { runArchiveJob } from "../lib/archive-service";

// 默认配置
const DEFAULT_ARCHIVE_AFTER_DAYS = 14;

async function main() {
  console.log("Starting Linear archive job...");

  // 1. 校验 LINEAR_API_KEY
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("Error: Missing LINEAR_API_KEY environment variable");
    process.exit(1);
  }

  // 2. 读取环境变量
  const daysStr = process.env.ARCHIVE_AFTER_DAYS;
  const archiveAfterDays =
    daysStr && !Number.isNaN(Number(daysStr))
      ? Number(daysStr)
      : DEFAULT_ARCHIVE_AFTER_DAYS;

  const teamKey = process.env.LINEAR_TEAM_KEY;
  const dryRun = process.env.DRY_RUN !== "false";

  console.log(`Configuration:`);
  console.log(`- Archive items closed more than ${archiveAfterDays} days ago`);
  console.log(`- Team filter: ${teamKey || "None (All teams)"}`);
  console.log(`- Dry run: ${dryRun} (Set DRY_RUN=false to execute)`);

  const linear = new LinearClient({ apiKey });

  try {
    const result = await runArchiveJob({
      client: linear,
      archiveAfterDays,
      teamKey,
      dryRun,
      onProgress: () => process.stdout.write("."),
      log: (msg) => console.log(msg),
    });

    console.log("\nDone!");
    console.log(`Total candidates found: ${result.totalCandidates}`);
    console.log(`Total archived: ${result.archivedCount}`);
  } catch (error: any) {
    console.error("\nError executing archive job:", error);
    process.exit(1);
  }
}

main();
