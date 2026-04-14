FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install deps (cached layer)
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Build stage (dev deps for drizzle-kit)
FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# No build step needed for Bun runtime — it runs TS directly

# Runtime
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app ./

EXPOSE 3001
CMD ["sh", "-c", "bunx drizzle-kit migrate && bun src/index.ts"]
