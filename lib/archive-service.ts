import { LinearClient } from "@linear/sdk";

export interface ArchiveOptions {
    client: LinearClient;
    archiveAfterDays: number;
    teamKey?: string;
    dryRun: boolean;
    onProgress?: () => void;
    log?: (msg: string) => void;
}

export interface PreviewIssue {
    id: string;
    identifier: string;
    title: string;
    url: string;
}

export interface ArchiveResult {
    totalCandidates: number;
    archivedCount: number;
    previewIssues: PreviewIssue[];
}

const PAGE_SIZE = 50;

export function daysToRelativeDuration(days: number): string {
    const d = Math.max(1, Math.floor(days));
    return `-P${d}D`;
}

export async function runArchiveJob(
    options: ArchiveOptions
): Promise<ArchiveResult> {
    const { client, archiveAfterDays, teamKey, dryRun, onProgress, log } = options;

    const relativeDuration = daysToRelativeDuration(archiveAfterDays);
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

    let afterCursor: string | undefined = undefined;
    let totalCandidates = 0;
    let archivedCount = 0;
    const previewIssues: PreviewIssue[] = [];

    while (true) {
        if (onProgress) onProgress();

        // If implementing "archive", the items disappear from the filtered view as they are archived.
        // So we should NOT use a cursor for the next page if we just cleared the current page.
        // However, Linear API pagination with concurrent modification can be tricky.
        // Safe strategy:
        // - Dry run: standard pagination (use cursors).
        // - Execute: always fetch the first page again? Not necessarily, because `after` cursor depends on ordering.
        //   If we sort by completedAt asc, and we archive them, they are gone.
        //   Safest for "process all matching" is:
        //   - Fetch page.
        //   - If empty, break.
        //   - Process items.
        //   - If we archived items, they are removed from the set. We should probably re-fetch from start (cursor=undefined) OR
        //     if we rely on the fact that we processed the WHOLE page, we can fetch again.
        //     BUT, if we only processed PART of the page (e.g. error), it's complex.
        //
        //   CLI strategy was: `const cursorToUse = dryRun ? afterCursor : undefined;`
        //   This implies: In execution mode, we always ask for the *first* page of matching results. 
        //   Since we archive (remove) them, the "next" page of results essentially shifts into the first page position.
        //   This is robust for "queue processing".
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
                if (log) log(`[Dry Run] Would archive: ${issue.identifier} - ${issue.title}`);
                previewIssues.push({
                    id: issue.id,
                    identifier: issue.identifier,
                    title: issue.title,
                    url: issue.url,
                });
            } else {
                await client.archiveIssue(issue.id);
                if (log) log(`[Archived] ${issue.identifier} - ${issue.title}`);
                archivedCount += 1;
            }
        }

        if (dryRun) {
            if (!issuesConnection.pageInfo.hasNextPage) {
                break;
            }
            afterCursor = issuesConnection.pageInfo.endCursor || undefined;
        } else {
            // In execute mode, since we modify the list, we treat it as a queue.
            // If we received fewer items than PAGE_SIZE, we probably exhausted the list.
            if (nodes.length < PAGE_SIZE) {
                break;
            }
            // Otherwise, we loop back with cursor=undefined to get the *next* batch of matching items
            // (which are now at the front).
        }
    }

    return {
        totalCandidates,
        archivedCount,
        previewIssues,
    };
}
