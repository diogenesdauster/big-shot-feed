# Tasks: OutSystems Docs Sync Service

**Feature Branch**: `001-outsystems-docs-sync`
**Plan**: `specs/001-outsystems-docs-sync/plan.md`

## Phase 1 — Project Setup

- [ ] **T001** — Initialize Bun project
  - `bun init -y`
  - `bun add hono zod drizzle-orm postgres @octokit/rest gray-matter js-yaml`
  - `bun add -d drizzle-kit @types/js-yaml`

- [ ] **T002** [P] — Configure tsconfig strict + ESLint
- [ ] **T003** [P] — Create `.env.example` with all required vars
- [ ] **T004** [P] — Create Dockerfile (Bun alpine)

## Phase 2 — Foundational

- [ ] **T005** — Create `src/env.ts` (Zod validation)
- [ ] **T006** — Create `src/lib/logger.ts`
- [ ] **T007** — Create `src/db/schema.ts` (repos, topics, sync_runs, webhooks)
- [ ] **T008** — Create `src/db/client.ts` singleton + initial migration
- [ ] **T009** — Seed initial repos: docs-odc, docs-product, docs-howtos

## Phase 3 — GitHub Client & Parsing

- [ ] **T010** — Create `src/github/client.ts` (Octokit + rate limit handling)
- [ ] **T011** — Create `src/github/parseToc.ts` (yaml → tree structure)
- [ ] **T012** — Create `src/github/parseMarkdown.ts` (gray-matter + link normalization)
- [ ] **T013** — Create `src/lib/linkNormalizer.ts` (relative → absolute .md paths)
- [ ] **T014** — Create `src/github/sync.ts` (orchestrator with diff detection)

## Phase 4 — API Routes (US1 + US2 + US3)

- [ ] **T015** — Create `src/routes/topics.ts` (GET /v1/topics, /v1/topics/:path)
- [ ] **T016** — Create `src/routes/updates.ts` (GET /v1/updates)
- [ ] **T017** — Create `src/routes/repos.ts` (GET /v1/repos)
- [ ] **T018** — Create `src/lib/apiKey.ts` (admin middleware)
- [ ] **T019** — Create `src/routes/admin.ts` (health + manual sync)
- [ ] **T020** — Create `src/index.ts` (Hono app, mount routes)

## Phase 5 — Cron & Webhooks (US4 + US5)

- [ ] **T021** — Create `src/cron/scheduler.ts` (hourly sync)
- [ ] **T022** — Create `src/lib/webhookDelivery.ts` (send with HMAC + retry)
- [ ] **T023** — Create `src/routes/webhooks.ts` (CRUD)
- [ ] **T024** — Wire webhook delivery into sync completion
- [ ] **T025** — Wire scheduler into `src/index.ts` startup

## Phase 6 — Deploy

- [ ] **T026** — Create PostgreSQL database `bigshot_feed` on Dokploy-postgres
- [ ] **T027** — Create Dokploy app "big-shot-feed" in `services` project
- [ ] **T028** — Configure env vars + domain `feed.bigshot.arcadia.dauster.xyz`
- [ ] **T029** — Deploy + verify `curl .../v1/repos`
- [ ] **T030** — Run first manual sync via `POST /v1/admin/sync`
- [ ] **T031** — Verify scheduled sync after 1h wait
