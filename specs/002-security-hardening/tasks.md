# Tasks: Security Hardening (big-shot-feed)

**Feature Branch**: `002-security-hardening`
**Plan**: `specs/002-security-hardening/plan.md`

## Phase 1 — Rate Limiting (BF-1: MEDIUM)

- [x] **T001** — Create `src/lib/rateLimit.ts` middleware
- [x] **T002** — Apply to public routes (50 req/10s): `/v1/topics`, `/v1/repos`, `/v1/updates`
- [x] **T003** — Apply to admin routes (10 req/10s): `/v1/admin/*`
- [x] **T004** — Verify: 100 rapid requests → some get 429

## Phase 2 — Verification

- [x] **T005** — Re-run web assessment for feed
- [x] **T006** — Update TROUBLESHOOTING.md + constitution

**Total**: 6 tasks
