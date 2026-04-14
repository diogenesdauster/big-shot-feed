import { Hono } from "hono";
import { db, schema } from "../db/client";

export const reposRouter = new Hono();

/**
 * GET /v1/repos — list all configured repos.
 */
reposRouter.get("/", async (c) => {
  const all = await db.select().from(schema.repos);
  return c.json({
    repos: all.map((r) => ({
      slug: r.slug,
      owner: r.owner,
      name: r.name,
      branch: r.branch,
      enabled: r.enabled,
      filesCount: r.filesCount,
      lastSyncAt: r.lastSyncAt,
      lastCommitSha: r.lastCommitSha,
    })),
  });
});
