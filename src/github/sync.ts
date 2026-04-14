import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/client";
import { log, logError, logWarn } from "../lib/logger";
import { env } from "../env";
import { octokit, checkRateLimit } from "./client";
import { parseToc } from "./parseToc";
import { parseMarkdown } from "./parseMarkdown";
import { notifyWebhooks } from "../lib/webhookDelivery";
import type { Repo } from "../db/schema";

const MODULE = "sync";

export interface SyncResult {
  repoSlug: string;
  status: "success" | "failed" | "skipped";
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  errorMessage?: string;
}

/**
 * Syncs a single repo. Detects changes via commit SHA comparison.
 */
export async function syncRepo(repo: Repo): Promise<SyncResult> {
  log(MODULE, `Starting sync`, { repo: repo.slug });

  if (env.DRY_RUN) {
    log(MODULE, `[DRY RUN] Skipping actual sync for ${repo.slug}`);
    return { repoSlug: repo.slug, status: "success", filesAdded: 0, filesModified: 0, filesDeleted: 0 };
  }

  const ok = await checkRateLimit();
  if (!ok) {
    return { repoSlug: repo.slug, status: "skipped", filesAdded: 0, filesModified: 0, filesDeleted: 0, errorMessage: "rate_limited" };
  }

  // Create sync_run row
  const [run] = await db
    .insert(schema.syncRuns)
    .values({ repoId: repo.id, status: "running" })
    .returning();
  if (!run) throw new Error("Failed to create sync_run");

  try {
    // Get latest commit SHA
    const { data: latestCommit } = await octokit.repos.getCommit({
      owner: repo.owner,
      repo: repo.name,
      ref: repo.branch,
    });

    const newSha = latestCommit.sha;
    const oldSha = repo.lastCommitSha;

    // Same SHA — no changes
    if (oldSha && oldSha === newSha) {
      log(MODULE, `No changes`, { repo: repo.slug, sha: newSha });
      await db
        .update(schema.syncRuns)
        .set({ status: "success", finishedAt: new Date() })
        .where(eq(schema.syncRuns.id, run.id));
      return { repoSlug: repo.slug, status: "success", filesAdded: 0, filesModified: 0, filesDeleted: 0 };
    }

    // Initial sync OR delta sync
    let changedFiles: Array<{ path: string; status: string }> = [];

    if (!oldSha) {
      // Initial sync — fetch entire tree
      log(MODULE, `Initial sync — fetching full tree`, { repo: repo.slug });
      const { data: tree } = await octokit.git.getTree({
        owner: repo.owner,
        repo: repo.name,
        tree_sha: newSha,
        recursive: "true",
      });
      changedFiles = tree.tree
        .filter((entry) => {
          if (entry.type !== "blob" || !entry.path) return false;
          if (entry.path === "toc.yml") return true;
          // Only include .md files inside src/ — skip .github/, .cursor/, styles/, etc.
          return entry.path.startsWith("src/") && entry.path.endsWith(".md");
        })
        .map((entry) => ({ path: entry.path as string, status: "added" }));
    } else {
      // Delta sync — compare two commits
      log(MODULE, `Delta sync`, { repo: repo.slug, from: oldSha, to: newSha });
      const { data: compare } = await octokit.repos.compareCommitsWithBasehead({
        owner: repo.owner,
        repo: repo.name,
        basehead: `${oldSha}...${newSha}`,
      });
      changedFiles = (compare.files ?? [])
        .filter((f) => {
          if (!f.filename) return false;
          if (f.filename === "toc.yml") return true;
          return f.filename.startsWith("src/") && f.filename.endsWith(".md");
        })
        .map((f) => ({ path: f.filename, status: f.status }));
    }

    log(MODULE, `Processing ${changedFiles.length} files`, { repo: repo.slug });

    let filesAdded = 0;
    let filesModified = 0;
    let filesDeleted = 0;
    const addedPaths: string[] = [];
    const modifiedPaths: string[] = [];
    const deletedPaths: string[] = [];

    // Parse toc.yml first if changed (so parentPath is correct)
    const tocChanged = changedFiles.some((f) => f.path === "toc.yml");
    const tocMap: Map<string, { parentPath: string | null; tocOrder: number; title: string }> = new Map();

    if (tocChanged || !oldSha) {
      try {
        const tocRaw = await fetchFileContent(repo.owner, repo.name, "toc.yml", newSha);
        const tocNodes = parseToc(tocRaw);
        for (const node of tocNodes) {
          // Prepend src/ prefix — OutSystems docs layout has src/<path>
          const srcPath = `src/${node.href}`;
          tocMap.set(srcPath, { parentPath: node.parentPath ? `src/${node.parentPath}` : null, tocOrder: node.tocOrder, title: node.title });
        }
        log(MODULE, `Parsed toc.yml`, { repo: repo.slug, nodes: tocNodes.length });
      } catch (err) {
        logWarn(MODULE, `Failed to parse toc.yml, continuing without TOC metadata`, { error: String(err) });
      }
    }

    // Process each changed .md file
    for (const file of changedFiles) {
      if (file.path === "toc.yml") continue; // Already handled

      if (file.status === "removed") {
        await db
          .delete(schema.topics)
          .where(and(eq(schema.topics.repoId, repo.id), eq(schema.topics.path, file.path)));
        filesDeleted++;
        deletedPaths.push(file.path);
        continue;
      }

      try {
        const raw = await fetchFileContent(repo.owner, repo.name, file.path, newSha);
        const parsed = parseMarkdown(raw, file.path);

        // Prefer frontmatter title > parsed H1 title
        const fmTitle = typeof parsed.frontmatter["summary"] === "string" ? undefined : parsed.frontmatter["title"];
        const title = (typeof fmTitle === "string" && fmTitle) || parsed.title;

        const tocEntry = tocMap.get(file.path);

        const existing = await db
          .select()
          .from(schema.topics)
          .where(and(eq(schema.topics.repoId, repo.id), eq(schema.topics.path, file.path)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(schema.topics).values({
            repoId: repo.id,
            path: file.path,
            title,
            parentPath: tocEntry?.parentPath ?? null,
            tocOrder: tocEntry?.tocOrder ?? 0,
            frontmatter: parsed.frontmatter,
            content: parsed.content,
            wordCount: parsed.wordCount,
            lastCommitSha: newSha,
            lastUpdatedAt: new Date(),
          });
          filesAdded++;
          addedPaths.push(file.path);
        } else {
          await db
            .update(schema.topics)
            .set({
              title,
              parentPath: tocEntry?.parentPath ?? existing[0]!.parentPath,
              tocOrder: tocEntry?.tocOrder ?? existing[0]!.tocOrder,
              frontmatter: parsed.frontmatter,
              content: parsed.content,
              wordCount: parsed.wordCount,
              lastCommitSha: newSha,
              lastUpdatedAt: new Date(),
            })
            .where(and(eq(schema.topics.repoId, repo.id), eq(schema.topics.path, file.path)));
          filesModified++;
          modifiedPaths.push(file.path);
        }
      } catch (err) {
        logWarn(MODULE, `Failed to process file`, { repo: repo.slug, file: file.path, error: String(err) });
      }
    }

    // Count total files for repo
    const [{ count = 0 } = { count: 0 }] = await db
      .select({ count: schema.topics.id })
      .from(schema.topics)
      .where(eq(schema.topics.repoId, repo.id)) as unknown as Array<{ count: number }>;

    // Update repo metadata
    await db
      .update(schema.repos)
      .set({
        lastSyncAt: new Date(),
        lastCommitSha: newSha,
      })
      .where(eq(schema.repos.id, repo.id));

    // Finalize sync_run
    await db
      .update(schema.syncRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        filesAdded,
        filesModified,
        filesDeleted,
      })
      .where(eq(schema.syncRuns.id, run.id));

    log(MODULE, `Sync complete`, { repo: repo.slug, filesAdded, filesModified, filesDeleted });

    // Notify webhooks if anything changed
    if (filesAdded + filesModified + filesDeleted > 0) {
      try {
        await notifyWebhooks({
          event: "sync.complete",
          repo: repo.slug,
          added: addedPaths,
          modified: modifiedPaths,
          deleted: deletedPaths,
          commitSha: newSha,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        logWarn(MODULE, "Webhook dispatch failed", { error: String(err) });
      }
    }

    return { repoSlug: repo.slug, status: "success", filesAdded, filesModified, filesDeleted };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logError(MODULE, `Sync failed`, { repo: repo.slug, error: errorMessage });

    await db
      .update(schema.syncRuns)
      .set({ status: "failed", finishedAt: new Date(), errorMessage })
      .where(eq(schema.syncRuns.id, run.id));

    return { repoSlug: repo.slug, status: "failed", filesAdded: 0, filesModified: 0, filesDeleted: 0, errorMessage };
  }
}

/**
 * Fetches raw file content via raw.githubusercontent.com.
 * This bypasses GitHub API rate limits entirely (raw CDN is unlimited for public repos).
 */
async function fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
  }
  return resp.text();
}

/**
 * Syncs all enabled repos in sequence (to respect rate limits).
 */
export async function syncAllRepos(): Promise<SyncResult[]> {
  const all = await db.select().from(schema.repos).where(eq(schema.repos.enabled, true));
  const results: SyncResult[] = [];
  for (const repo of all) {
    results.push(await syncRepo(repo));
  }
  return results;
}
