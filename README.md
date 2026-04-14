# big-shot-feed 📡

> News aggregation service for OutSystems — consumable REST API.

Part of the [big-shot](../big-shot) podcast studio project.

---

## What it does

Scrapes OutSystems news from multiple sources and exposes them as a clean, paginated REST API:

- **blog.outsystems.com** (RSS)
- **community.outsystems.com** (HTML scraping)
- **GitHub releases** (OutSystems org repos)
- **YouTube channel** (RSS of channel uploads)

Output: `GET /v1/news?since=2026-04-01&source=blog-outsystems`

## Stack

| Role | Tech |
|------|------|
| Runtime | Bun |
| Framework | Hono |
| DB | PostgreSQL 16 (Drizzle ORM, schema `bigshot_feed`) |
| GitHub metadata | Octokit (`@octokit/rest`) |
| GitHub content | `raw.githubusercontent.com` (unlimited CDN) |
| Markdown parsing | gray-matter + js-yaml |
| Cron | Bun interval |
| Validation | Zod |
| Deploy | Dokploy on Arcadia VM |

**Architecture note**: Metadata (commits, tree) goes through Octokit; file content bypasses the API entirely via raw CDN. See `docs/TROUBLESHOOTING.md` #4 for the full story and Principle VI in the constitution.

## Development

```bash
# Prereqs: Bun, PostgreSQL running
cp .env.example .env

bun install
bun drizzle-kit migrate
bun run dev
```

API at http://localhost:3001

## Endpoints

### Public
- `GET /v1/news` — List news items (filters: `since`, `source`, `limit`)
- `GET /v1/sources` — List available sources

### Admin (requires `x-api-key`)
- `GET /v1/admin/health` — Source health status
- `POST /v1/admin/scrape` — Trigger manual scrape

## Why a separate service?

See the [big-shot constitution](../big-shot/.specify/memory/constitution.md), Principle III.

TL;DR: Feed aggregation is reusable infrastructure. Other future clients (Slack bots, dashboards, analytics) can consume the same API without touching the podcast app.

## Spec-Driven Development

This project uses [SpecKit](https://github.com/github/spec-kit). See:
- `.specify/memory/constitution.md` — project principles
- `specs/001-outsystems-news-aggregator/` — current feature spec + plan + tasks

## Deployment

Deployed to Dokploy on Arcadia VM at `feed.bigshot.arcadia.dauster.xyz`.
