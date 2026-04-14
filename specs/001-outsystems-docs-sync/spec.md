# Feature Specification: OutSystems Docs Sync Service

**Feature Branch**: `001-outsystems-docs-sync`
**Created**: 2026-04-13
**Status**: Draft
**Input**: Standalone service that syncs OutSystems official documentation from GitHub and exposes it as a consumable REST API

## Background

OutSystems mantém a documentação oficial em 3 repositórios públicos no GitHub, **actualizados diariamente**:

- `OutSystems/docs-odc` — OutSystems Developer Cloud (plataforma nova, com AI/agents)
- `OutSystems/docs-product` — OutSystems 11 (plataforma clássica)
- `OutSystems/docs-howtos` — How-to guides cross-platform

Cada repo tem:
- `toc.yml` — árvore estruturada de tópicos (~994 linhas no docs-odc)
- `src/**/*.md` — ficheiros Markdown com frontmatter YAML (summary, tags, guid, audience)
- Histórico Git com commits reais de mudanças na documentação

Este serviço sincroniza esses repos, normaliza os tópicos, detecta mudanças, e expõe tudo como API REST consumível pelo `big-shot` (ou qualquer outro cliente).

## User Scenarios & Testing

### User Story 1 — Browse the Docs Tree (Priority: P0)

Qualquer cliente precisa de obter a árvore completa de tópicos disponíveis num repo, com metadata (título, path, parent section, children).

**Why this priority**: É a navegação principal. Sem árvore, não há "escolher tópico".

**Independent Test**: `curl https://feed.bigshot.arcadia.dauster.xyz/v1/topics?repo=docs-odc` retorna JSON com árvore navegável.

**Acceptance Scenarios**:

1. **Given** `toc.yml` sincronizado, **When** `GET /v1/topics?repo=docs-odc`, **Then** retorna árvore com todas as secções e sub-tópicos
2. **Given** param `?section=agentic-development`, **When** request, **Then** retorna apenas essa subárvore
3. **Given** param `?flat=true`, **When** request, **Then** retorna lista plana de todos os ficheiros (sem hierarquia)
4. **Given** repo inexistente, **When** request, **Then** retorna 404 com mensagem clara

---

### User Story 2 — Read Topic Content (Priority: P0)

Cliente precisa de obter o conteúdo Markdown completo de um tópico específico para gerar o brief/script do podcast.

**Why this priority**: É o conteúdo real. Sem isto, não há material de episódio.

**Independent Test**: `curl https://feed.../v1/topics/eap/agentic-development/mentor-web/create-app` retorna JSON com o ficheiro Markdown parseado.

**Acceptance Scenarios**:

1. **Given** path válido, **When** GET, **Then** retorna `{ path, title, frontmatter, content, wordCount, lastUpdatedAt, commitSha }`
2. **Given** ficheiro com frontmatter YAML (tags, audience, summary), **When** GET, **Then** frontmatter é parseado e retornado como objecto separado
3. **Given** path com links internos (`[ref](other.md)`), **When** GET, **Then** links são normalizados para paths absolutos
4. **Given** param `?raw=true`, **When** GET, **Then** retorna Markdown cru sem parsing

---

### User Story 3 — Detect Updates Since Date (Priority: P0)

Cliente precisa de saber o que mudou na documentação desde uma data, para sugerir novos episódios ou refreshes.

**Why this priority**: É a feature diferenciadora — "automatic episode suggestions" depende disto.

**Independent Test**: `curl https://feed.../v1/updates?since=2026-04-01` retorna JSON com tópicos alterados.

**Acceptance Scenarios**:

1. **Given** commits no repo desde a data, **When** GET, **Then** retorna `{ added: [], modified: [], deleted: [] }` com paths e commit SHAs
2. **Given** PR mergeado adiciona novo ficheiro, **When** GET após o merge, **Then** o path aparece em `added`
3. **Given** commit altera `.md` existente, **When** GET, **Then** path aparece em `modified` com diff URL
4. **Given** sem mudanças no período, **When** GET, **Then** retorna todas as listas vazias

---

### User Story 4 — Background Sync (Priority: P0)

Sistema precisa de manter a réplica local actualizada sem intervenção manual.

**Why this priority**: Sem sync contínuo, o cache fica desactualizado.

**Independent Test**: Esperar 1h, verificar que `sync_runs` tem novo registo e novos commits estão reflectidos.

**Acceptance Scenarios**:

1. **Given** cron configurado (1h), **When** hora passa, **Then** cada repo é pollado via GitHub API (commits + tree)
2. **Given** novo commit detectado, **When** sync roda, **Then** os ficheiros alterados são re-fetched e atualizados no cache
3. **Given** `toc.yml` alterado, **When** sync roda, **Then** a árvore é rebuilt completamente
4. **Given** GitHub rate limit atingido, **When** sync, **Then** aguarda até reset (não crasha)

---

### User Story 5 — Webhook on Updates (Priority: P1)

Clientes (big-shot) precisam de ser notificados em tempo real quando há mudanças, para criar episódios automaticamente.

**Why this priority**: Evita polling do lado do cliente, permite workflow "commit → new episode draft".

**Independent Test**: Registar webhook, alterar algo no cache, verificar que o endpoint recebeu POST.

**Acceptance Scenarios**:

1. **Given** webhook configurado via `POST /v1/webhooks`, **When** sync detecta mudanças, **Then** envia POST com `{ repo, added: [], modified: [], deleted: [] }`
2. **Given** webhook endpoint retorna 5xx, **When** delivery falha, **Then** retry com backoff (até 3×)
3. **Given** multiple webhooks registados, **When** sync, **Then** todos são notificados

---

### User Story 6 — Admin Health Dashboard (Priority: P2)

Dauster precisa de ver o estado dos repos, última sync, erros.

**Why this priority**: Operacional.

**Acceptance Scenarios**:

1. **Given** sistema rodando, **When** `GET /v1/admin/health`, **Then** retorna `{ repos: [{ name, lastSyncAt, lastCommitSha, filesCount, sizeKb }] }`
2. **Given** sync falhou 3×, **When** health, **Then** status = "degraded"

---

### Edge Cases

- Repo arquivado ou renomeado — sync falha com mensagem clara, operador é avisado
- Ficheiro `.md` com frontmatter inválido — retorna content mas frontmatter como `{}`
- Commit muito grande (>1000 ficheiros alterados) — batching e paginação
- GitHub API 403 rate limit — backoff exponencial, retry após reset
- `toc.yml` malformado — mantém árvore antiga, loga erro
- Link interno quebrado (.md apagado) — retornar normalizado mesmo assim, cliente decide

## Requirements

### Functional Requirements

- **FR-001**: API MUST expor `GET /v1/topics?repo=<name>` retornando árvore parseada de `toc.yml`
- **FR-002**: API MUST expor `GET /v1/topics/:path` retornando conteúdo + frontmatter do `.md`
- **FR-003**: API MUST expor `GET /v1/updates?since=<date>&repo=<name>` retornando diff
- **FR-004**: API MUST expor `GET /v1/repos` listando repos configurados
- **FR-005**: API MUST expor `GET /v1/admin/health` (autenticado)
- **FR-006**: API MUST expor `POST /v1/admin/sync?repo=<name>` para trigger manual
- **FR-007**: Sistema MUST pollar os 3 repos OutSystems via GitHub API a cada hora (configurável)
- **FR-008**: Sistema MUST parsear `toc.yml` como YAML estruturado
- **FR-009**: Sistema MUST parsear frontmatter YAML dos ficheiros `.md`
- **FR-010**: Sistema MUST persistir tópicos, conteúdo, e commits em PostgreSQL
- **FR-011**: Sistema MUST suportar webhooks de notificação de mudanças
- **FR-012**: Sistema MUST suportar DRY_RUN para dev local
- **FR-013**: Sistema MUST normalizar paths de links internos em ficheiros Markdown
- **FR-014**: Sistema MUST cachear git blob SHAs para evitar re-fetch desnecessário

### Key Entities

- **Repo**: ID, slug, owner, name, branch, enabled, lastSyncAt, lastCommitSha, filesCount
- **Topic**: ID, repoId, path, title, parentPath, frontmatter (JSONB), content (TEXT), wordCount, blobSha, lastCommitSha, lastUpdatedAt
- **SyncRun**: ID, repoId, startedAt, finishedAt, status, filesAdded, filesModified, filesDeleted, errorMessage
- **Webhook**: ID, url, secret, repoFilter (JSON array), enabled, lastDeliveryAt, failureCount

## Success Criteria

- **SC-001**: `GET /v1/topics?repo=docs-odc` responde em < 200ms (cache hit)
- **SC-002**: `GET /v1/topics/:path` responde em < 150ms
- **SC-003**: Sync hourly dos 3 repos completa em < 3 minutos
- **SC-004**: Zero perda de updates — todos os commits desde a última sync são capturados
- **SC-005**: RAM usage < 150MB em runtime
- **SC-006**: DB size < 500MB após 1 ano (3 repos x ~200 ficheiros x pequenas versões)
- **SC-007**: Webhook delivery < 5s após detecção de mudança

## Assumptions

- GitHub API rate limit (5000/h authenticated) é suficiente — os 3 repos têm poucos commits por hora
- PostgreSQL disponível (Dokploy-postgres shared, schema `bigshot_feed`)
- Domínio `feed.bigshot.arcadia.dauster.xyz` configurado via wildcard DNS
- `GITHUB_TOKEN` opcional mas recomendado (raise rate limit)
- Conteúdo dos `.md` cabe confortavelmente em PostgreSQL TEXT (maior ficheiro ~100KB)

## Out of Scope (for this spec)

- Tradução de docs para pt-BR (pode ser fase 2)
- Full-text search (pode ser fase 2 com tsvector)
- Image/diagram extraction (só texto por agora)
- Cross-repo linking resolution (só dentro do mesmo repo)
