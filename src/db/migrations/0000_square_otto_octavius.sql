CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"branch" text DEFAULT 'main' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_commit_sha" text,
	"files_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"status" text NOT NULL,
	"files_added" integer DEFAULT 0 NOT NULL,
	"files_modified" integer DEFAULT 0 NOT NULL,
	"files_deleted" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_id" integer NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"parent_path" text,
	"toc_order" integer DEFAULT 0 NOT NULL,
	"frontmatter" jsonb DEFAULT '{}'::jsonb,
	"content" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"blob_sha" text,
	"last_commit_sha" text,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"repo_filter" jsonb DEFAULT '[]'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_delivery_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repos_slug_idx" ON "repos" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_repo_path_idx" ON "topics" USING btree ("repo_id","path");--> statement-breakpoint
CREATE INDEX "topics_repo_updated_idx" ON "topics" USING btree ("repo_id","last_updated_at");