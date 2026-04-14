import { pgTable, serial, text, boolean, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

// ── repos ──────────────────────────────────────
export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    branch: text("branch").notNull().default("main"),
    enabled: boolean("enabled").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at"),
    lastCommitSha: text("last_commit_sha"),
    filesCount: integer("files_count").notNull().default(0),
  },
  (t) => ({
    slugIdx: uniqueIndex("repos_slug_idx").on(t.slug),
  })
);

// ── topics ─────────────────────────────────────
export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    repoId: integer("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    title: text("title").notNull(),
    parentPath: text("parent_path"),
    tocOrder: integer("toc_order").notNull().default(0),
    frontmatter: jsonb("frontmatter").$type<Record<string, unknown>>().default({}),
    content: text("content").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    blobSha: text("blob_sha"),
    lastCommitSha: text("last_commit_sha"),
    lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  },
  (t) => ({
    repoPathIdx: uniqueIndex("topics_repo_path_idx").on(t.repoId, t.path),
    repoUpdatedIdx: index("topics_repo_updated_idx").on(t.repoId, t.lastUpdatedAt),
  })
);

// ── sync_runs ──────────────────────────────────
export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  repoId: integer("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  status: text("status").notNull(), // 'success' | 'failed' | 'running'
  filesAdded: integer("files_added").notNull().default(0),
  filesModified: integer("files_modified").notNull().default(0),
  filesDeleted: integer("files_deleted").notNull().default(0),
  errorMessage: text("error_message"),
});

// ── webhooks ───────────────────────────────────
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  repoFilter: jsonb("repo_filter").$type<string[]>().default([]),
  enabled: boolean("enabled").notNull().default(true),
  lastDeliveryAt: timestamp("last_delivery_at"),
  failureCount: integer("failure_count").notNull().default(0),
});

// Types
export type Repo = typeof repos.$inferSelect;
export type NewRepo = typeof repos.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
