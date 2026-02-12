import { LinearClient } from "@linear/sdk";

interface ArchiveOptions {
  client: LinearClient;
  archiveAfterDays: number;
  teamKey: string;
  dryRun: boolean;
  onProgress?: () => void;
  log?: (msg: string) => void;
}

interface ArchiveResult {
  totalCandidates: number;
  archivedCount: number;
}

const DEFAULT_ARCHIVE_AFTER_DAYS = 14;
const PAGE_SIZE = 50;

function daysToRelativeDuration(days: number): string {
  const d = Math.max(1, Math.floor(days));
  return `-P${d}D`;
}

async function runArchiveJob(options: ArchiveOptions): Promise<ArchiveResult> {
  const { client, archiveAfterDays, teamKey, dryRun, onProgress, log } = options;

  const relativeDuration = daysToRelativeDuration(archiveAfterDays);
  const filter: any = {
    or: [{ completedAt: { lt: relativeDuration } }, { canceledAt: { lt: relativeDuration } }],
    team: {
      key: {
        eq: teamKey,
      },
    },
  };

  let afterCursor: string | undefined;
  let totalCandidates = 0;
  let archivedCount = 0;

  while (true) {
    onProgress?.();

    const cursorToUse = dryRun ? afterCursor : undefined;
    const issuesConnection = await client.issues({
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
        log?.(`[Dry Run] Would archive: ${issue.identifier} - ${issue.title}`);
      } else {
        await client.archiveIssue(issue.id);
        log?.(`[Archived] ${issue.identifier} - ${issue.title}`);
        archivedCount += 1;
      }
    }

    if (dryRun) {
      if (!issuesConnection.pageInfo.hasNextPage) {
        break;
      }
      afterCursor = issuesConnection.pageInfo.endCursor || undefined;
    } else if (nodes.length < PAGE_SIZE) {
      break;
    }
  }

  return { totalCandidates, archivedCount };
}

async function main() {
  console.log("Starting Linear archive job...");

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("Error: Missing LINEAR_API_KEY environment variable");
    process.exit(1);
  }

  const teamKey = process.env.LINEAR_TEAM_KEY;
  if (!teamKey) {
    console.error("Error: Missing LINEAR_TEAM_KEY environment variable");
    process.exit(1);
  }

  const daysStr = process.env.ARCHIVE_AFTER_DAYS;
  const archiveAfterDays =
    daysStr && !Number.isNaN(Number(daysStr))
      ? Number(daysStr)
      : DEFAULT_ARCHIVE_AFTER_DAYS;

  const dryRun = process.env.DRY_RUN === "true";

  console.log("Configuration:");
  console.log(`- Archive items completed or canceled more than ${archiveAfterDays} days ago`);
  console.log(`- Team filter: ${teamKey}`);
  console.log(`- Dry run: ${dryRun} (Set DRY_RUN=true for preview mode)`);

  const linear = new LinearClient({ apiKey });
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
}

main().catch((error: unknown) => {
  console.error("\nError executing archive job:", error);
  process.exit(1);
});
