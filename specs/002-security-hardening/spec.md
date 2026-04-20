# Feature Specification: Security Hardening (big-shot-feed)

**Feature Branch**: `002-security-hardening`
**Created**: 2026-04-20
**Status**: Draft
**Input**: Web Assessment Report (big-shot/docs/WEB-ASSESSMENT-2026-04-20.md)

## Findings Addressed

| # | ID | Severity | Finding |
|---|---|---|---|
| 1 | BF-1 | 🟡 MEDIUM | No rate limiting on public API endpoints |

**Note**: Admin auth, SQLi, path traversal, and error handling all PASSED the assessment.

## User Scenarios & Testing

### User Story 1 — Rate Limiting on Public API (Priority: P1)

Public endpoints (`/v1/topics`, `/v1/repos`, `/v1/updates`) MUST have rate limiting.

**Acceptance Scenarios**:

1. **Given** normal usage, **When** 1 req/s, **Then** 200
2. **Given** burst (>50 req in 10s from same IP), **When** next request, **Then** 429
3. **Given** rate limited, **When** wait 60s, **Then** access restored
4. **Given** admin endpoints, **When** burst, **Then** rate limit also applies

## Requirements

- **FR-001**: Public API MUST rate limit to 50 req/10s per IP
- **FR-002**: Rate limited responses MUST return 429 with `Retry-After` header
- **FR-003**: Admin endpoints MUST also be rate limited (10 req/10s)

## Success Criteria

- **SC-001**: 100 rapid requests to `/v1/repos` → some get 429
- **SC-002**: Normal authenticated feed sync still works
