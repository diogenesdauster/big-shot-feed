# big-shot-feed — Troubleshooting & Dev Reference

Problems encountered during implementation + deploy, with preventive rules.

---

## 1. drizzle-kit CLI hangs in Docker without TTY

**Sintoma**: Container em crashloop, logs mostram `[⣷] applying migrations...` que nunca termina, exit code 1.

**Causa**: `bunx drizzle-kit migrate` é uma ferramenta CLI interactiva que precisa de TTY. No Docker Swarm (Dokploy), o processo não tem TTY e entra em loop infinito.

**Solução**: Criar um script programático que chama o migrator directamente via API:

```ts
// src/db/migrate.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);
await migrate(db, { migrationsFolder: "./src/db/migrations" });
await client.end();
process.exit(0);
```

E no Dockerfile:
```dockerfile
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/db/seed.ts && bun src/index.ts"]
```

**Regra**: CLIs interactivos (drizzle-kit, prisma migrate, etc.) MUST ser substituídos por chamadas programáticas em entrypoints de container. Reservar o CLI para dev local.

**Data**: 2026-04-14

---

## 2. PostgresError: unrecognized configuration parameter "schema"

**Sintoma**: `PostgresError: unrecognized configuration parameter "schema"` com severity FATAL, code `42704`.

**Causa**: `DATABASE_URL` contém `?schema=public` no final, o que é um **Prisma-ism** que não funciona com outros drivers. O `postgres-js` tenta executar `SET schema = 'public'` que é um param PostgreSQL inválido.

**Solução**: Remover `?schema=public` do `DATABASE_URL`:

```
# Errado:
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# Correcto:
DATABASE_URL=postgresql://user:pass@host:5432/db
```

**Regra**: `?schema=public` só é aceite pelo Prisma. Para `postgres-js`, `pg`, `postgres.js`, etc., a URL MUST ser apenas `postgresql://user:pass@host:port/database`. O schema default é `public` automaticamente.

**Data**: 2026-04-14

---

## 3. OutSystems docs-product usa branch `master`, não `main`

**Sintoma**: Sync falha com erro GitHub API 422 `No commit found for SHA: main`.

**Causa**: O repo `OutSystems/docs-product` é mais antigo e ainda usa o branch default `master`. `docs-odc` e `docs-howtos` usam `main`. Assumir `main` para todos os repos é incorrecto.

**Solução**: Verificar `default_branch` via GitHub API antes de seed:
```bash
curl -s "https://api.github.com/repos/OutSystems/docs-product" | jq .default_branch
# → "master"
```

Seed com o valor correcto:
```ts
{ slug: "docs-product", owner: "OutSystems", name: "docs-product", branch: "master" }
```

**Regra**: NUNCA assumir `main` como branch default. MUST fazer lookup via `GET /repos/:owner/:repo` ou configurar por repo. Fallback: `HEAD` como symbolic ref.

**Data**: 2026-04-14

---

## 4. GitHub API rate limit exhausted via `repos.getContent()` in loop

**Sintoma**: Após 1-2 syncs, todos os requests começam a retornar 403 com "API rate limit exceeded" ou "abuse detection mechanism".

**Causa**: Sync fazia **um `repos.getContent()` por ficheiro**. Com ~2600 ficheiros × 3 repos:
```
Cada sync = ~2600 requests
Rate limit autenticado = 5000/hora
→ 2 syncs numa hora e pronto, bloqueado
```

**Solução**: Usar `raw.githubusercontent.com` directamente (CDN, sem rate limit para repos públicos):

```ts
// ANTES (limitado):
async function fetchFileContent(owner, repo, path, ref) {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

// DEPOIS (unlimited):
async function fetchFileContent(owner, repo, path, ref) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.text();
}
```

**Resultado**:
```
ANTES: ~2600 requests/sync × 3 tentativas = 7800 → bloqueio
DEPOIS: ~3 requests/sync via API + bulk via CDN = praticamente ilimitado
```

**Regra**: GitHub API é para **metadata** (getTree, getCommit, compareCommits, webhooks). **raw CDN** é para conteúdo de ficheiros individuais. Codificado na constitution como Principle VI.

**Data**: 2026-04-14

---

## 5. Sync incluía lixo: `.github/`, `.cursor/`, `styles/`, `README.md`

**Sintoma**: `/v1/topics?repo=docs-odc` retornava 768 items incluindo `.cursor/commands/doc-write.md`, `.github/copilot-instructions.md`, `styles/alex/README.md` — nenhum desses é documentação consumível.

**Causa**: O filtro inicial era apenas `.endsWith(".md")`, pegando qualquer markdown do repo.

**Solução**: Restringir para ficheiros dentro de `src/` (convention do layout OutSystems docs):

```ts
changedFiles = tree.tree
  .filter((entry) => {
    if (entry.type !== "blob" || !entry.path) return false;
    if (entry.path === "toc.yml") return true;
    return entry.path.startsWith("src/") && entry.path.endsWith(".md");
  });
```

**Regra**: Filtros de sync MUST ser **whitelist** (só aceita caminhos específicos) em vez de **blacklist**. Menos risco de incluir lixo novo quando o repo adiciona pastas.

**Data**: 2026-04-14

---

## 6. Dokploy env var updates não aplicam sem redeploy explícito

**Sintoma**: Actualizei `GITHUB_TOKEN` via API tRPC, mas `docker exec env` mostrava o valor antigo.

**Causa**: Dokploy grava as env vars no DB mas não faz restart automático do service. `docker service update --force` não é suficiente — precisa de `application.deploy` via API para re-render o Swarm spec.

**Solução**:
```bash
# Via MCP
mcp__dokploy__application-deploy --applicationId=<id> --title="Pick up env changes"

# Ou via tRPC directo
curl -X POST https://arcadia.dauster.xyz/api/trpc/application.deploy \
  -H "x-api-key: <dokploy_token>" \
  -d '{"json":{"applicationId":"<id>"}}'
```

**Regra**: Após actualizar env vars no Dokploy, MUST fazer `application.deploy` explícito — não confiar em `docker service update --force`.

**Data**: 2026-04-14
