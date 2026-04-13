# Technical Plan: OutSystems News Aggregator

**Feature Branch**: `001-outsystems-news-aggregator`
**Created**: 2026-04-12
**Spec**: `specs/001-outsystems-news-aggregator/spec.md`

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Consumable by Anyone | PASS | API versioned `/v1/`, JSON response, Zod schema |
| II. Source Adapter Pattern | PASS | Each source in `src/sources/<slug>.ts` with common interface |
| III. Cache-First | PASS | All reads serve from Postgres cache; cron updates in background |
| IV. Deduplication | PASS | Canonical URL is unique index on `news_items` |
| V. Health Monitoring | PASS | `scrape_runs` table + health endpoint |

## Technical Context

### Stack

| Role | Technology | Rationale |
|------|-----------|-----------|
| Runtime | Bun | Fast cold start, TypeScript native, small footprint |
| Framework | Hono | Minimal API framework, excellent DX, works great with Bun |
| DB | PostgreSQL 16 | Shared Dokploy instance, schema `bigshot_feed` |
| ORM | Drizzle | Lightweight, SQL-like, no client generation, fits Bun well |
| HTTP parsing | cheerio | jQuery-like API for HTML scraping |
| RSS parsing | fast-xml-parser | Fast XML → JSON for RSS feeds |
| Cron | node-cron | Simple cron syntax, works in Bun |
| Validation | Zod | Standard across the stack |

**Alternatives considered**:
- **Prisma vs Drizzle**: Drizzle chosen — Bun native, no code generation, simpler migrations
- **Fastify vs Hono**: Hono chosen — smaller bundle, better Bun integration
- **Elysia vs Hono**: Hono chosen — more mature ecosystem

## Folder Structure

```
big-shot-feed/
├── src/
│   ├── index.ts                  # Hono app entrypoint
│   ├── env.ts                    # Zod-validated env vars
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema definitions
│   │   ├── client.ts             # Drizzle client singleton
│   │   └── migrations/           # SQL migration files
│   ├── sources/
│   │   ├── index.ts              # Registry of all sources
│   │   ├── types.ts              # NewsItem, Source, ScrapeRun types + Zod
│   │   ├── blog-outsystems.ts    # RSS adapter for blog.outsystems.com
│   │   ├── community.ts          # HTML adapter for community.outsystems.com
│   │   ├── github.ts             # GitHub releases adapter
│   │   └── youtube.ts            # YouTube channel adapter
│   ├── routes/
│   │   ├── news.ts               # GET /v1/news
│   │   ├── sources.ts            # GET /v1/sources
│   │   └── admin.ts              # Admin endpoints (health, scrape)
│   ├── lib/
│   │   ├── canonicalUrl.ts       # URL normalization for dedup
│   │   ├── logger.ts             # Structured logging
│   │   └── apiKey.ts             # Admin API key middleware
│   └── cron/
│       └── scheduler.ts          # Cron setup + run orchestrator
├── drizzle.config.ts
├── Dockerfile
├── docker-compose.yml            # For local dev
├── package.json
├── bun.lockb
├── tsconfig.json
├── .env.example
└── README.md
```

## Data Model

### news_items
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| canonical_url | text | UNIQUE NOT NULL |
| title | text | NOT NULL |
| excerpt | text | NULL |
| thumbnail_url | text | NULL |
| published_at | timestamp | NOT NULL (indexed desc) |
| source_id | int | FK → sources.id |
| raw_html | text | NULL (compressed body) |
| created_at | timestamp | DEFAULT now() |

Indexes: `(published_at DESC)`, `(source_id, published_at DESC)`, `canonical_url UNIQUE`

### sources
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| slug | text | UNIQUE (e.g., 'blog-outsystems') |
| name | text | Display name |
| base_url | text | NOT NULL |
| adapter_type | text | 'rss' \| 'html' \| 'github' \| 'youtube' |
| enabled | bool | DEFAULT true |
| last_run_at | timestamp | NULL |
| consecutive_failures | int | DEFAULT 0 |

### scrape_runs
| Column | Type | Notes |
|--------|------|-------|
| id | serial | PK |
| source_id | int | FK → sources.id |
| started_at | timestamp | NOT NULL |
| finished_at | timestamp | NULL |
| status | text | 'success' \| 'failed' \| 'running' |
| items_found | int | DEFAULT 0 |
| items_new | int | DEFAULT 0 |
| error_message | text | NULL |

## API Contracts

### GET /v1/news
**Query**: `since?`, `source?`, `limit?` (default 50, max 200)
**Response**: `{ items: NewsItem[], count: number }`

### GET /v1/sources
**Response**: `{ sources: Source[] }`

### GET /v1/admin/health
**Headers**: `x-api-key: <ADMIN_KEY>`
**Response**: `{ sources: [{ slug, status, lastRunAt, itemsLast24h, consecutiveFailures }] }`

### POST /v1/admin/scrape
**Headers**: `x-api-key: <ADMIN_KEY>`
**Body**: `{ source?: string }`
**Response**: `{ ok: true, runId: number }`

## Deployment Strategy

- Dockerfile with Bun base image (`oven/bun:1-alpine`)
- Deployed to Dokploy as Docker app in `services` project
- Domain: `feed.bigshot.arcadia.dauster.xyz`
- Env vars managed via Dokploy panel
- Database created manually on Dokploy-postgres: `bigshot_feed`
- Migrations run at container start via `bun drizzle-kit migrate`

## Complexity Tracking

| Item | Risk | Mitigation |
|------|------|------------|
| HTML scraping (community) breaks | High | Start with RSS/API sources first, add HTML adapters later |
| GitHub rate limit | Low | Cache aggressively, use authenticated requests |
| YouTube quota | Medium | Use RSS feed of channel (no quota) as primary |
| Dedup collisions | Medium | Robust canonical URL function with test suite |
