# Tasks: OutSystems Docs Sync Service

**Feature Branch**: `001-outsystems-docs-sync`
**Plan**: `specs/001-outsystems-docs-sync/plan.md`

## Phase 1 — Project Setup

- [x] **T001** — Initialize Bun project *(2026-04-14)*
  - `bun init -y` + all deps installed
- [x] **T002** — Configure tsconfig strict *(2026-04-14)*
  - Bun init already generated strict config
- [x] **T003** — Create `.env.example` *(2026-04-14)*
- [x] **T004** — Create Dockerfile (Bun alpine) *(2026-04-14)*

## Phase 2 — Foundational

- [x] **T005** — Create `src/env.ts` (Zod validation) *(2026-04-14)*
- [x] **T006** — Create `src/lib/logger.ts` *(2026-04-14)*
- [x] **T007** — Create `src/db/schema.ts` *(2026-04-14)*
  - Tables: repos, topics, sync_runs, webhooks
- [x] **T008** — Create `src/db/client.ts` singleton + initial migration *(2026-04-14)*
  - Migration: `src/db/migrations/0000_square_otto_octavius.sql`
- [x] **T009** — Seed script: docs-odc, docs-product, docs-howtos *(2026-04-14)*
  - `src/db/seed.ts`

## Phase 3 — GitHub Client & Parsing

- [x] **T010** — Create `src/github/client.ts` *(2026-04-14)*
- [x] **T011** — Create `src/github/parseToc.ts` *(2026-04-14)*
  - **Tested**: Parsed 748 nodes from real docs-odc toc.yml, 17 top-level sections
- [x] **T012** — Create `src/github/parseMarkdown.ts` *(2026-04-14)*
  - **Tested**: Parsed `create-app.md` — 774 words, 12 frontmatter keys
- [x] **T013** — Create `src/lib/canonicalPath.ts` *(2026-04-14)*
- [x] **T014** — Create `src/github/sync.ts` orchestrator *(2026-04-14)*
  - Delta sync via `compareCommitsWithBasehead`, initial via tree fetch

## Phase 4 — API Routes

- [x] **T015** — Create `src/routes/topics.ts` *(2026-04-14)*
- [x] **T016** — Create `src/routes/updates.ts` *(2026-04-14)*
- [x] **T017** — Create `src/routes/repos.ts` *(2026-04-14)*
- [x] **T018** — Create `src/lib/apiKey.ts` *(2026-04-14)*
- [x] **T019** — Create `src/routes/admin.ts` *(2026-04-14)*
  - Health + manual sync with consecutive failure tracking
- [x] **T020** — Create `src/index.ts` Hono app *(2026-04-14)*

## Phase 5 — Cron & Webhooks

- [x] **T021** — Create `src/cron/scheduler.ts` *(2026-04-14)*
  - setInterval-based, DRY_RUN safe, startup warmup
- [x] **T022** — Create `src/lib/webhookDelivery.ts` *(2026-04-14)*
  - HMAC sha256 signing, 3 retries with exponential backoff
- [x] **T023** — Create `src/routes/webhooks.ts` *(2026-04-14)*
  - POST/GET/DELETE `/v1/admin/webhooks` with Zod validation
- [x] **T024** — Wire webhook delivery into sync *(2026-04-14)*
  - `sync.complete` event dispatched after successful sync
- [x] **T025** — Wire scheduler into `src/index.ts` startup *(2026-04-14)*

## Phase 6 — Deploy

- [x] **T026** — Create PostgreSQL database `bigshot_feed` *(2026-04-14)*
- [x] **T027** — Create Dokploy app "big-shot-feed" *(2026-04-14)*
  - Source: GitHub https://github.com/diogenesdauster/big-shot-feed (public)
  - Build type: Dockerfile
- [x] **T028** — Configure env vars + domain *(2026-04-14)*
  - Domain: `feed.bigshot.arcadia.dauster.xyz`
  - SSL: Let's Encrypt
- [x] **T029** — Deploy + verify API *(2026-04-14)*
  - `GET /v1/repos` → 200 with 3 repos
  - `GET /v1/topics?repo=docs-odc` → works
  - `GET /v1/topics/:path?repo=docs-odc` → returns frontmatter + content
- [x] **T030** — First manual sync *(2026-04-14)*
  - Clean sync via raw CDN, zero API calls consumed
  - docs-odc: 751 files
  - docs-product: 1676 files
  - docs-howtos: 138 files
  - **Total: 2565 topics** sincronizados
- [x] **T031** — Scheduler verified *(2026-04-14)*
  - Runs hourly via Bun setInterval
  - Single-flight guard prevents concurrent runs
  - DRY_RUN check on startup

## Status Summary

- **Phase 1-5** (local implementation): ✅ **Complete** (24/29 tasks)
- **Webhooks** (T022-T024): Deferred to v1.1 — MVP ships without real-time push
- **Phase 6** (deploy): Pending — requires DB creation on Arcadia

**Zero TypeScript errors** on final compile.
**Local smoke tests passing**: parseToc + parseMarkdown verified against real OutSystems docs.
