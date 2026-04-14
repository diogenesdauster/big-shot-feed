import { Hono } from "hono";
import { env } from "./env";
import { log } from "./lib/logger";
import { topicsRouter } from "./routes/topics";
import { updatesRouter } from "./routes/updates";
import { reposRouter } from "./routes/repos";
import { adminRouter } from "./routes/admin";
import { startScheduler } from "./cron/scheduler";

const MODULE = "app";

const app = new Hono();

// Health check (no auth)
app.get("/", (c) => c.json({ name: "big-shot-feed", status: "ok" }));
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// API v1
app.route("/v1/topics", topicsRouter);
app.route("/v1/updates", updatesRouter);
app.route("/v1/repos", reposRouter);
app.route("/v1/admin", adminRouter);

// 404
app.notFound((c) => c.json({ error: "Not Found" }, 404));

// Start scheduler in background
startScheduler();

log(MODULE, `Starting big-shot-feed on port ${env.PORT}`, { dryRun: env.DRY_RUN });

export default {
  port: env.PORT,
  fetch: app.fetch,
};
