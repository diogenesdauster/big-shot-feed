import { Hono } from "hono";
import { eq, and, gt } from "drizzle-orm";
import { db, schema } from "../db/client";

export const updatesRouter = new Hono();

/**
 * GET /v1/updates?since=<ISO date>&repo=<slug>
 * Returns topics added/modified after the given date.
 */
updatesRouter.get("/", async (c) => {
  const sinceStr = c.req.query("since");
  const repoSlug = c.req.query("repo");

  if (!sinceStr) return c.json({ error: "Missing ?since parameter" }, 400);
  const since = new Date(sinceStr);
  if (isNaN(since.getTime())) return c.json({ error: "Invalid ?since date" }, 400);

  const filters = [gt(schema.topics.lastUpdatedAt, since)];

  if (repoSlug) {
    const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.slug, repoSlug)).limit(1);
    if (!repo) return c.json({ error: "Repo not found" }, 404);
    filters.push(eq(schema.topics.repoId, repo.id));
  }

  const updated = await db
    .select()
    .from(schema.topics)
    .where(and(...filters))
    .orderBy(schema.topics.lastUpdatedAt);

  return c.json({
    since: since.toISOString(),
    modified: updated.map((t) => ({
      path: t.path,
      title: t.title,
      wordCount: t.wordCount,
      lastUpdatedAt: t.lastUpdatedAt,
      lastCommitSha: t.lastCommitSha,
    })),
  });
});
