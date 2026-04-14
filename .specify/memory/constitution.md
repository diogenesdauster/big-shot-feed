<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0 (initial ratification)
Based on: big-shot constitution (Principle III — Separation of Concerns)
-->

# big-shot-feed Constitution

> News aggregator service — consumable data source for `big-shot` and future clients.
> Inspired by Cowboy Bebop's information brokers (Laughing Bull, Ed).

## Core Principles

### I. Consumable by Anyone (NON-NEGOTIABLE)

O feed MUST ser consumível por qualquer cliente HTTP sem conhecimento interno do serviço.
Acoplamento a um cliente específico destrói a razão de existir do feed como serviço separado.

- API MUST ser versionada: `/v1/news`, `/v2/news`, etc.
- Response schema MUST ser documentado via OpenAPI/JSON Schema
- Breaking changes MUST incrementar versão major da API
- Nenhum cliente MUST ter tratamento especial — todos usam a mesma API pública
- Autenticação MUST ser opcional para reads (API key apenas para rate limiting)

---

### II. Source Adapter Pattern (NON-NEGOTIABLE)

Cada fonte de notícias MUST ser implementada como adapter independente com interface comum.
Misturar lógica de scraping com lógica de normalização cria código impossível de manter.

- Cada source (blog.outsystems.com, community, GitHub releases, YouTube) MUST ser um módulo `sources/<slug>.ts`
- Cada adapter MUST implementar: `fetch(since?: Date): Promise<NewsItem[]>`
- Output MUST ser normalizado para o schema comum `NewsItem` antes de chegar ao cache
- Adicionar nova source MUST ser apenas criar novo adapter + adicionar ao registry

---

### III. Cache-First, Scrape-On-Demand

O feed MUST responder ao cliente a partir do cache — scraping acontece em background.
Fazer scraping síncrono ao receber request é receita para latência e rate limiting.

- API reads MUST servir sempre do PostgreSQL cache
- Cron interno MUST correr a cada hora (configurável) para atualizar cache
- Cada scrape run MUST ser registado em `scrape_runs` com timestamp, source, items found, errors
- Client MUST poder forçar refresh via `?fresh=true` (rate-limited)

---

### IV. Deduplication by Canonical URL

Items duplicados destroem a confiança do consumidor.
Fontes diferentes muitas vezes re-publicam a mesma notícia — MUST ser detectado.

- URL canónica (sem query params de tracking, www/non-www normalizado) MUST ser a chave de dedup
- Items com mesma URL canónica MUST ser merged, mantendo o mais recente
- Hash do título + source MUST ser backup para items sem URL

---

### V. Source Health Monitoring

Sources quebram silenciosamente (site redesign, HTML muda, rate limits).
Detectar falhas MUST ser automático, não manual.

- Cada scrape run MUST registar sucesso/falha por source
- Alert MUST ser disparado se uma source falhar 3× consecutivas
- Admin endpoint MUST expor health status por source
- Falha de uma source MUST NOT afectar as outras

---

### VI. API vs CDN Discipline (NON-NEGOTIABLE)

GitHub API (e equivalentes) é para **metadata e mutations**; CDNs são para **bulk content reads**.
Usar API para ler centenas de ficheiros é receita para rate limits e latência desnecessária.

- **GitHub API** (Octokit) MUST ser usado APENAS para:
  - Listar árvores (`getTree`) — 1 request retorna N ficheiros
  - Descobrir commits (`getCommit`, `compareCommits`) — 1 request com metadata
  - Webhooks, releases, issues — operações de controlo
- **raw.githubusercontent.com** MUST ser usado para ler conteúdo de ficheiros individuais de repos públicos — sem rate limit, mesmo CDN que `git clone` usa por baixo
- Nenhum sync MUST chamar `repos.getContent()` em loop para N ficheiros — é o anti-padrão #1
- Cálculo obrigatório no `plan.md`: **requests API × syncs/hora vs 5000/h limit** antes de implementar
- Qualquer bulk read futuro (S3, DockerHub, qualquer CDN-backed store) MUST seguir a mesma regra

**Métrica antes/depois no big-shot-feed**:
```
ANTES: ~2600 requests/sync × 3 tentativas/hora = 7800 → rate limit stuck
DEPOIS: ~3 requests/sync × N tentativas = ilimitado na prática
```

---

## Stack Constraints

- **Runtime**: Bun (TypeScript native, rápido startup)
- **Framework**: Hono (minimal API framework)
- **DB**: PostgreSQL 16 (schema `bigshot_feed`)
- **ORM**: Prisma OR Drizzle (decidir em plan.md)
- **Scraping**: `fetch` nativo + `cheerio` para HTML parsing
- **Cron**: `node-cron` ou Bun cron nativo
- **Validation**: Zod
- **Deploy**: Dokploy (domain: `feed.bigshot.arcadia.dauster.xyz`)

---

## Code Conventions

Seguir as mesmas convenções de `big-shot` (Module Identity, Retry Standard, DRY_RUN Guard, Zod Usage, Naming Conventions).

---

## Governance

**Version**: 1.0.0 | **Ratified**: 2026-04-12 | **Last Amended**: 2026-04-12
