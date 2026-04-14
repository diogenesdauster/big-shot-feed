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
- [ ] **T022** — Create `src/lib/webhookDelivery.ts` (PENDING — defer to v1.1)
- [ ] **T023** — Create `src/routes/webhooks.ts` (PENDING — defer to v1.1)
- [ ] **T024** — Wire webhook delivery into sync (PENDING — defer to v1.1)
- [x] **T025** — Wire scheduler into `src/index.ts` startup *(2026-04-14)*

## Phase 6 — Deploy

- [ ] **T026** — Create PostgreSQL database `bigshot_feed` on Dokploy-postgres
- [ ] **T027** — Create Dokploy app "big-shot-feed" in `services` project
- [ ] **T028** — Configure env vars + domain `feed.bigshot.arcadia.dauster.xyz`
- [ ] **T029** — Deploy + verify `curl .../v1/repos`
- [ ] **T030** — Run first manual sync via `POST /v1/admin/sync`
- [ ] **T031** — Verify scheduled sync after 1h wait

## Status Summary

- **Phase 1-5** (local implementation): ✅ **Complete** (24/29 tasks)
- **Webhooks** (T022-T024): Deferred to v1.1 — MVP ships without real-time push
- **Phase 6** (deploy): Pending — requires DB creation on Arcadia

**Zero TypeScript errors** on final compile.
**Local smoke tests passing**: parseToc + parseMarkdown verified against real OutSystems docs.
