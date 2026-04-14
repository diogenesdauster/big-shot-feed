import { Hono } from "hono";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { syncRepo, syncAllRepos } from "../github/sync";
import { adminAuth } from "../lib/apiKey";

export const adminRouter = new Hono();
adminRouter.use("*", adminAuth);

/**
 * GET /v1/admin/health — health status of all repos and webhooks.
 */
adminRouter.get("/health", async (c) => {
  const repos = await db.select().from(schema.repos);

  const enriched = await Promise.all(
    repos.map(async (r) => {
      const [lastRun] = await db
        .select()
        .from(schema.syncRuns)
        .where(eq(schema.syncRuns.repoId, r.id))
        .orderBy(desc(schema.syncRuns.startedAt))
        .limit(1);

      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentRuns = await db
        .select()
        .from(schema.syncRuns)
        .where(and(eq(schema.syncRuns.repoId, r.id), gte(schema.syncRuns.startedAt, last24h)));

      const consecutiveFailures = countConsecutiveFailures(recentRuns);
      const status =
        !r.enabled ? "disabled" :
        consecutiveFailures >= 3 ? "degraded" :
        lastRun?.status === "failed" ? "warning" :
        "healthy";

      return {
        slug: r.slug,
        status,
        lastSyncAt: r.lastSyncAt,
        lastCommitSha: r.lastCommitSha,
        lastRunStatus: lastRun?.status ?? null,
        lastRunError: lastRun?.errorMessage ?? null,
        filesCount: r.filesCount,
        runsLast24h: recentRuns.length,
        consecutiveFailures,
      };
    })
  );

  return c.json({ repos: enriched });
});

/**
 * POST /v1/admin/sync { repo?: string }
 * Trigger manual sync. If no repo specified, sync all enabled repos.
 */
adminRouter.post("/sync", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoSlug = body.repo;

  if (repoSlug) {
    const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.slug, repoSlug)).limit(1);
    if (!repo) return c.json({ error: "Repo not found" }, 404);
    const result = await syncRepo(repo);
    return c.json({ ok: true, result });
  }

  const results = await syncAllRepos();
  return c.json({ ok: true, results });
});

function countConsecutiveFailures(runs: typeof schema.syncRuns.$inferSelect[]): number {
  let count = 0;
  const sorted = [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  for (const run of sorted) {
    if (run.status === "failed") count++;
    else break;
  }
  return count;
}
