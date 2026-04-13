# Feature Specification: OutSystems News Aggregator

**Feature Branch**: `001-outsystems-news-aggregator`
**Created**: 2026-04-12
**Status**: Draft
**Input**: Standalone API service that aggregates OutSystems news from multiple sources and exposes them as consumable REST API

## User Scenarios & Testing

### User Story 1 — Fetch Latest News (Priority: P0)

Qualquer cliente HTTP (big-shot app, dashboards, bots) precisa de obter as últimas notícias OutSystems via REST API.

**Why this priority**: É a única razão de existir do serviço. Sem isto, não há feed.

**Independent Test**: `curl https://feed.bigshot.arcadia.dauster.xyz/v1/news` retorna JSON com items.

**Acceptance Scenarios**:

1. **Given** cache populado, **When** `GET /v1/news`, **Then** retorna array de `NewsItem` ordenado por `publishedAt` desc
2. **Given** param `?since=2026-04-01`, **When** request, **Then** apenas items publicados após essa data
3. **Given** param `?source=blog-outsystems`, **When** request, **Then** apenas items dessa source
4. **Given** param `?limit=10`, **When** request, **Then** máximo 10 items no response
5. **Given** request sem items, **When** cache vazio para filtro, **Then** retorna `{ items: [] }` (não erro)

---

### User Story 2 — Background Scraping (Priority: P0)

Sistema precisa de atualizar o cache periodicamente sem intervenção manual.

**Why this priority**: Sem scraping contínuo, o cache fica estagnado e o feed perde valor.

**Independent Test**: Esperar 1h, verificar que `scrape_runs` tem novo registo e `news_items` tem novos items.

**Acceptance Scenarios**:

1. **Given** cron configurado (1h), **When** hora passa, **Then** cada source adapter é invocado
2. **Given** adapter retorna items, **When** run completa, **Then** items novos são inseridos (dedup por URL canónica)
3. **Given** adapter falha com erro, **When** run continua, **Then** outras sources continuam normalmente (isolation)
4. **Given** source falha 3× consecutivas, **When** próxima run, **Then** alert é logado (Dauster vê nos logs Dokploy)

---

### User Story 3 — Source Adapter: blog.outsystems.com (Priority: P0)

Sistema precisa de um adapter funcional para o blog oficial.

**Why this priority**: É a fonte principal. Sem isto, não há conteúdo.

**Independent Test**: `POST /v1/admin/scrape?source=blog-outsystems` retorna items do blog.

**Acceptance Scenarios**:

1. **Given** RSS feed do blog disponível, **When** adapter executa, **Then** parseia todos os items do feed
2. **Given** item já existe (mesma URL), **When** insert, **Then** skip silencioso (dedup)
3. **Given** item sem thumbnail, **When** parse, **Then** cover = null (não falha)

---

### User Story 4 — Source Adapter: GitHub Releases (Priority: P1)

Sistema precisa de adapter para releases OutSystems no GitHub (forge repos, SDK updates).

**Why this priority**: Complementa o blog — developers querem saber de updates técnicos.

**Independent Test**: `POST /v1/admin/scrape?source=github-outsystems` retorna releases.

**Acceptance Scenarios**:

1. **Given** GitHub API acessível, **When** adapter executa, **Then** fetch releases de repos pré-configurados
2. **Given** release com body markdown, **When** parse, **Then** excerpt é primeiros 300 chars
3. **Given** GitHub rate limit atingido, **When** request, **Then** adapter aguarda até reset (não crasha)

---

### User Story 5 — Admin Health Dashboard (Priority: P2)

Dauster precisa de ver o estado das sources e debug falhas.

**Why this priority**: Operacional. Source quebra silenciosa é o maior risco.

**Independent Test**: `GET /v1/admin/health` retorna status por source.

**Acceptance Scenarios**:

1. **Given** sistema rodando, **When** GET health, **Then** retorna array `[{ source, lastRunAt, lastRunStatus, itemsLast24h, consecutiveFailures }]`
2. **Given** source com 3+ falhas, **When** health check, **Then** status = "degraded"
3. **Given** source disabled, **When** health check, **Then** status = "disabled"

---

### Edge Cases

- Source muda HTML structure — adapter começa a falhar, health detecta
- Duplicado cross-source (mesma notícia em blog + community) — dedup por URL canónica
- Item com caracteres especiais (emojis, acentos) — PostgreSQL UTF-8 handling
- Scrape demora mais que 5min — timeout com alert
- DB indisponível — read API retorna 503, scrape salta essa run

## Requirements

### Functional Requirements

- **FR-001**: API MUST expor `GET /v1/news` com filtros `since`, `source`, `limit`
- **FR-002**: API MUST expor `GET /v1/sources` listando sources disponíveis
- **FR-003**: API MUST expor `GET /v1/admin/health` (autenticado via API key)
- **FR-004**: API MUST expor `POST /v1/admin/scrape` para trigger manual (autenticado)
- **FR-005**: Sistema MUST ter adapter para blog.outsystems.com (RSS parsing)
- **FR-006**: Sistema MUST ter adapter para GitHub releases (API)
- **FR-007**: Sistema MUST ter adapter para community.outsystems.com (HTML scraping)
- **FR-008**: Sistema MUST ter adapter para YouTube OutSystems channel (YouTube Data API)
- **FR-009**: Sistema MUST rodar cron interno a cada hora (configurável)
- **FR-010**: Sistema MUST registar cada scrape run com status e metrics
- **FR-011**: Sistema MUST deduplizar por URL canónica
- **FR-012**: Sistema MUST persistir items no PostgreSQL (schema `bigshot_feed`)
- **FR-013**: Sistema MUST suportar DRY_RUN para dev local

### Key Entities

- **NewsItem**: ID, canonicalUrl (unique), title, excerpt, thumbnail, publishedAt, sourceId, rawHtml, createdAt
- **Source**: ID, slug, name, baseUrl, adapterType, enabled, lastRunAt, consecutiveFailures
- **ScrapeRun**: ID, sourceId, startedAt, finishedAt, status (success/failed), itemsFound, itemsNew, errorMessage

## Success Criteria

- **SC-001**: `GET /v1/news` responde em < 200ms (cache hit)
- **SC-002**: Scrape hourly completa em < 5 minutos para todas as sources
- **SC-003**: RAM usage < 150MB em runtime
- **SC-004**: Deploy via Dokploy em < 2 minutos (bun build rápido)
- **SC-005**: Zero duplicados no DB após 1 semana rodando
- **SC-006**: Health endpoint retorna em < 100ms

## Assumptions

- PostgreSQL disponível no Arcadia (Dokploy-postgres shared)
- Domínio `feed.bigshot.arcadia.dauster.xyz` configurado via wildcard DNS
- GitHub token opcional (só para raise de rate limit)
- YouTube API key opcional (podemos começar só com RSS do channel)
