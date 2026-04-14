# Technical Plan: OutSystems Docs Sync Service

**Feature Branch**: `001-outsystems-docs-sync`
**Spec**: `specs/001-outsystems-docs-sync/spec.md`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Consumable by Anyone | PASS | API versioned `/v1/`, REST + webhooks |
| II. Source Adapter Pattern | PASS | Each repo = "adapter" but all share GitHub API client |
| III. Cache-First | PASS | All reads serve from PostgreSQL; sync runs in background |
| IV. Deduplication | PASS | Primary key = `(repo_id, path)` — natural uniqueness |
| V. Health Monitoring | PASS | `sync_runs` table + health endpoint |
| VI. API vs CDN Discipline | PASS | Metadata via Octokit, content via raw.githubusercontent.com |

## Rate Limit Budget

**GitHub API** (5000/h authenticated):

| Operation | Calls per sync | Syncs per hour | Total |
|-----------|----------------|----------------|-------|
| `getCommit` (current SHA) | 1/repo × 3 repos | 1 | 3 |
| `getTree` (initial only) | 1/repo × 3 repos (first run) | 1 | 3 (one-time) |
| `compareCommits` (delta) | 1/repo × 3 repos | 1 | 3 |
| `checkRateLimit` (guard) | 1/sync | 1 | 1 |
| **Total per hourly sync** | | | **~7 requests** |

**Budget usage**: 7/5000 = 0.14% per hour. Supports >700 ad-hoc syncs/hour if needed.

**Raw CDN** (`raw.githubusercontent.com`):
- No rate limit for public repos
- Used for ALL file content reads (toc.yml, .md files)
- Average sync: ~30 files changed, ~30 CDN requests, no impact on API budget

## Technical Context

### Stack

| Role | Technology | Rationale |
|------|-----------|-----------|
| Runtime | Bun | Fast, TypeScript native, small footprint |
| Framework | Hono | Minimal API framework, excellent DX |
| DB | PostgreSQL 16 | Shared Dokploy instance, schema `bigshot_feed` |
| ORM | Drizzle | Lightweight, SQL-like, fits Bun |
| GitHub client | Octokit (`@octokit/rest`) | Official, handles rate limiting |
| Markdown parsing | gray-matter | Frontmatter extraction |
| YAML parsing | js-yaml | For `toc.yml` |
| Cron | Bun native scheduler | No external dep |
| Validation | Zod | Standard across stack |

## Folder Structure

```
big-shot-feed/
├── src/
│   ├── index.ts                  # Hono app entrypoint
│   ├── env.ts                    # Zod-validated env vars
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── client.ts             # Drizzle client singleton
│   │   └── migrations/
│   ├── github/
│   │   ├── client.ts             # Octokit client + rate limit
│   │   ├── sync.ts               # Sync orchestrator
│   │   ├── parseToc.ts           # Parse toc.yml → tree
│   │   └── parseMarkdown.ts      # Parse .md + frontmatter
│   ├── routes/
│   │   ├── topics.ts             # GET /v1/topics, /v1/topics/:path
│   │   ├── updates.ts            # GET /v1/updates
│   │   ├── repos.ts              # GET /v1/repos
│   │   ├── webhooks.ts           # CRUD /v1/webhooks
│   │   └── admin.ts              # Admin (health, manual sync)
│   ├── lib/
│   │   ├── logger.ts
│   │   ├── apiKey.ts             # Admin auth middleware
│   │   ├── linkNormalizer.ts     # Normalize .md links to absolute paths
│   │   └── webhookDelivery.ts    # Webhook sending with retry
│   └── cron/
│       └── scheduler.ts          # Hourly sync trigger
├── drizzle.config.ts
├── Dockerfile
├── package.json
├── .env.example
└── README.md
```

## Data Model

### repos
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| slug | text | UNIQUE (e.g., 'docs-odc') |
| owner | text | 'OutSystems' |
| name | text | 'docs-odc' |
| branch | text | DEFAULT 'main' |
| enabled | bool | DEFAULT true |
| last_sync_at | timestamp | NULL |
| last_commit_sha | text | NULL |
| files_count | int | DEFAULT 0 |

### topics
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| repo_id | int | FK → repos.id |
| path | text | e.g., 'eap/agentic-development/mentor-web/create-app.md' |
| title | text | Extracted from H1 or filename |
| parent_path | text | NULL for top-level sections |
| toc_order | int | Position in toc.yml tree |
| frontmatter | jsonb | Parsed YAML frontmatter |
| content | text | Full Markdown content |
| word_count | int | Indexed for episode length estimation |
| blob_sha | text | Git blob SHA for change detection |
| last_commit_sha | text | Last commit that touched this file |
| last_updated_at | timestamp | |

UNIQUE: `(repo_id, path)`
INDEX: `(repo_id, last_updated_at DESC)`, `(word_count)`

### sync_runs
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| repo_id | int | FK → repos.id |
| started_at | timestamp | |
| finished_at | timestamp | NULL while running |
| status | text | 'success' \| 'failed' \| 'running' |
| files_added | int | DEFAULT 0 |
| files_modified | int | DEFAULT 0 |
| files_deleted | int | DEFAULT 0 |
| error_message | text | NULL |

### webhooks
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| url | text | Target URL |
| secret | text | HMAC signing secret |
| repo_filter | jsonb | Array of repo slugs, empty = all |
| enabled | bool | DEFAULT true |
| last_delivery_at | timestamp | NULL |
| failure_count | int | DEFAULT 0 |

## API Contracts

### GET /v1/topics
**Query**: `repo` (required), `section?`, `flat?`
**Response**: `{ repo, tree: TocNode[] }` or `{ repo, items: Topic[] }` if flat

### GET /v1/topics/:path
**Params**: path (URL-encoded)
**Query**: `raw?`
**Response**: `{ path, title, frontmatter, content, wordCount, lastUpdatedAt, commitSha }`

### GET /v1/updates
**Query**: `since` (ISO date), `repo?`
**Response**: `{ since, added: Topic[], modified: Topic[], deleted: string[] }`

### GET /v1/repos
**Response**: `{ repos: Repo[] }`

### POST /v1/webhooks
**Body**: `{ url, secret, repoFilter: string[] }`
**Response**: `{ id, url, secret }`

### GET /v1/admin/health
**Headers**: `x-api-key`
**Response**: `{ repos: [...with sync status], webhooks: [...with delivery stats] }`

### POST /v1/admin/sync
**Headers**: `x-api-key`
**Body**: `{ repo?: string }`
**Response**: `{ ok: true, runId: number }`

## Sync Algorithm

```
For each enabled repo:
  1. Get latest commit SHA from GitHub API (main branch)
  2. If equal to repos.last_commit_sha → skip (no changes)
  3. Get tree diff between last_commit_sha and latest
  4. For each file in diff:
     - If .md or toc.yml:
       - Fetch raw content via /contents/:path or /git/blobs/:sha
       - Parse frontmatter + content
       - Upsert topics row (repo_id, path) → update content, blob_sha, last_updated_at
       - Classify as 'added' / 'modified' / 'deleted'
  5. If toc.yml changed: rebuild topic tree (parent_path, toc_order)
  6. Update repos.last_commit_sha + last_sync_at
  7. Insert sync_runs row with counts
  8. Notify webhooks (batched per repo)
```

## Deployment Strategy

- Dockerfile with `oven/bun:1-alpine` base
- Deployed to Dokploy as Docker app in `services` project
- Domain: `feed.bigshot.arcadia.dauster.xyz`
- Env vars managed via Dokploy panel: `DATABASE_URL`, `GITHUB_TOKEN`, `ADMIN_API_KEY`, `PORT`, `CRON_SCHEDULE`, `DRY_RUN`
- Database created manually: `bigshot_feed`
- Migrations run via `bun drizzle-kit migrate` at container start

## Complexity Tracking

| Item | Risk | Mitigation |
|------|------|------------|
| GitHub rate limit | Medium | Use authenticated requests + blob SHA cache |
| Large `.md` files (>100KB) | Low | PostgreSQL TEXT handles millions of chars fine |
| `toc.yml` parsing edge cases | Medium | Fuzz test with real files, handle nested topics recursively |
| Webhook delivery failures | Medium | Exponential backoff, dead-letter queue after 3 failures |
| Concurrent syncs on same repo | Low | Advisory lock via `pg_advisory_lock` |
