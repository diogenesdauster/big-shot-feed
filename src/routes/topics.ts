import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/client";
import { logWarn } from "../lib/logger";

export const topicsRouter = new Hono();

/**
 * GET /v1/topics?repo=<slug>&section=<path>&flat=<bool>
 *
 * Returns the topic tree (hierarchical) or flat list.
 */
topicsRouter.get("/", async (c) => {
  const repoSlug = c.req.query("repo");
  const section = c.req.query("section");
  const flat = c.req.query("flat") === "true";

  if (!repoSlug) return c.json({ error: "Missing ?repo parameter" }, 400);

  const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.slug, repoSlug)).limit(1);
  if (!repo) return c.json({ error: "Repo not found" }, 404);

  const allTopics = await db
    .select()
    .from(schema.topics)
    .where(eq(schema.topics.repoId, repo.id))
    .orderBy(schema.topics.tocOrder);

  const filtered = section ? allTopics.filter((t) => t.path.startsWith(section)) : allTopics;

  if (flat) {
    return c.json({
      repo: repoSlug,
      items: filtered.map((t) => ({
        path: t.path,
        title: t.title,
        parentPath: t.parentPath,
        wordCount: t.wordCount,
        lastUpdatedAt: t.lastUpdatedAt,
      })),
    });
  }

  // Build tree
  type TreeNode = {
    path: string;
    title: string;
    wordCount: number;
    children: TreeNode[];
  };

  const byPath = new Map<string, TreeNode>();
  for (const t of filtered) {
    byPath.set(t.path, { path: t.path, title: t.title, wordCount: t.wordCount, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const t of filtered) {
    const node = byPath.get(t.path)!;
    if (t.parentPath && byPath.has(t.parentPath)) {
      byPath.get(t.parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return c.json({ repo: repoSlug, tree: roots });
});

/**
 * GET /v1/topics/:path  (path is URL-encoded)
 * Query: ?raw=true returns Markdown without parsing links
 */
topicsRouter.get("/*", async (c) => {
  const path = c.req.path.replace(/^\/v1\/topics\//, "").replace(/^\/+/, "");
  const repoSlug = c.req.query("repo");

  if (!path) return c.json({ error: "Missing path" }, 400);
  if (!repoSlug) return c.json({ error: "Missing ?repo parameter" }, 400);

  const [repo] = await db.select().from(schema.repos).where(eq(schema.repos.slug, repoSlug)).limit(1);
  if (!repo) return c.json({ error: "Repo not found" }, 404);

  const [topic] = await db
    .select()
    .from(schema.topics)
    .where(and(eq(schema.topics.repoId, repo.id), eq(schema.topics.path, decodeURIComponent(path))))
    .limit(1);

  if (!topic) return c.json({ error: "Topic not found" }, 404);

  return c.json({
    path: topic.path,
    title: topic.title,
    frontmatter: topic.frontmatter,
    content: topic.content,
    wordCount: topic.wordCount,
    parentPath: topic.parentPath,
    lastUpdatedAt: topic.lastUpdatedAt,
    lastCommitSha: topic.lastCommitSha,
  });
});
