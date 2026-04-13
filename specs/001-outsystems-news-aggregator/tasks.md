# Tasks: OutSystems News Aggregator

**Feature Branch**: `001-outsystems-news-aggregator`
**Plan**: `specs/001-outsystems-news-aggregator/plan.md`

## Phase 1 — Project Setup

- [ ] **T001** — Initialize Bun project + install deps
  - `bun init -y` (creates package.json, tsconfig, .gitignore)
  - `bun add hono zod drizzle-orm postgres node-cron cheerio fast-xml-parser`
  - `bun add -d drizzle-kit @types/node-cron @types/cheerio`
  - Verify: `bun --version`, `package.json` has all deps

- [ ] **T002** [P] — Configure tsconfig.json strict mode
  - `strict: true`, `noUncheckedIndexedAccess: true`, `esModuleInterop: true`

- [ ] **T003** [P] — Create .env.example
  - Vars: `DATABASE_URL`, `ADMIN_API_KEY`, `PORT`, `CRON_SCHEDULE`, `DRY_RUN`, `GITHUB_TOKEN?`, `YOUTUBE_API_KEY?`

- [ ] **T004** [P] — Create Dockerfile (Bun base image)

## Phase 2 — Foundational

- [ ] **T005** — Create `src/env.ts` with Zod validation of env vars
- [ ] **T006** — Create `src/lib/logger.ts` with structured logging
- [ ] **T007** — Create `src/lib/canonicalUrl.ts` (URL normalization)
- [ ] **T008** — Create `src/sources/types.ts` (NewsItem, Source, ScrapeRun Zod schemas)
- [ ] **T009** — Create `src/db/schema.ts` (Drizzle schema for news_items, sources, scrape_runs)
- [ ] **T010** — Generate initial migration + create `src/db/client.ts` singleton

## Phase 3 — Source Adapters (US1 + US3 + US4)

- [ ] **T011** — Create `src/sources/index.ts` with adapter registry interface
- [ ] **T012** — Implement `src/sources/blog-outsystems.ts` (RSS parser)
- [ ] **T013** — Implement `src/sources/github.ts` (GitHub releases from configured repos)
- [ ] **T014** [P] — Implement `src/sources/youtube.ts` (YouTube channel RSS)
- [ ] **T015** [P] — Implement `src/sources/community.ts` (HTML scraping with cheerio)

## Phase 4 — API Routes (US1)

- [ ] **T016** — Create `src/routes/news.ts` → `GET /v1/news` (filters + pagination)
- [ ] **T017** — Create `src/routes/sources.ts` → `GET /v1/sources`
- [ ] **T018** — Create `src/lib/apiKey.ts` (middleware for admin endpoints)
- [ ] **T019** — Create `src/routes/admin.ts` → `GET /v1/admin/health`, `POST /v1/admin/scrape`
- [ ] **T020** — Create `src/index.ts` (Hono app, mount routes, 404 handler)

## Phase 5 — Cron Orchestration (US2)

- [ ] **T021** — Create `src/cron/scheduler.ts` (hourly job + run orchestrator)
- [ ] **T022** — Wire scheduler into `src/index.ts` startup
- [ ] **T023** — Implement consecutive failure tracking + logging

## Phase 6 — Deploy

- [ ] **T024** — Create PostgreSQL database `bigshot_feed` on Dokploy-postgres
- [ ] **T025** — Create Dokploy app "big-shot-feed" in `services` project
- [ ] **T026** — Configure env vars via Dokploy API + domain `feed.bigshot.arcadia.dauster.xyz`
- [ ] **T027** — Deploy + verify `curl https://feed.bigshot.arcadia.dauster.xyz/v1/sources`
- [ ] **T028** — Seed initial sources via `POST /v1/admin/scrape`
- [ ] **T029** — Verify scrape runs after 1 hour wait
