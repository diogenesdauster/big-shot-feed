import { env } from "../env";
import { log, logError } from "../lib/logger";
import { syncAllRepos } from "../github/sync";

const MODULE = "scheduler";

let isRunning = false;

async function runSync(): Promise<void> {
  if (isRunning) {
    log(MODULE, "Skipping — previous run still in progress");
    return;
  }
  isRunning = true;
  try {
    log(MODULE, "Starting scheduled sync");
    const results = await syncAllRepos();
    log(MODULE, "Scheduled sync complete", {
      totalRepos: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
    });
  } catch (err) {
    logError(MODULE, "Scheduled sync crashed", { error: String(err) });
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the scheduler. Uses a simple interval — CRON_SCHEDULE is a hint for docs but
 * we just convert `0 * * * *` to hourly. For more complex schedules, swap for node-cron.
 */
export function startScheduler(): void {
  if (env.DRY_RUN) {
    log(MODULE, "DRY_RUN enabled — scheduler disabled");
    return;
  }

  // Simple interval: default hourly
  const intervalMs = parseScheduleMs(env.CRON_SCHEDULE);
  log(MODULE, `Scheduler started`, { intervalMs, schedule: env.CRON_SCHEDULE });

  // Run once at startup (after 30s warm-up)
  setTimeout(() => void runSync(), 30_000);

  // Recurring
  setInterval(() => void runSync(), intervalMs);
}

function parseScheduleMs(schedule: string): number {
  // Minimal parser: recognize common cron patterns, default 1h
  if (schedule === "0 * * * *") return 60 * 60 * 1000; // hourly
  if (schedule === "*/5 * * * *") return 5 * 60 * 1000; // every 5 min
  if (schedule === "*/30 * * * *") return 30 * 60 * 1000; // every 30 min
  if (schedule === "0 */6 * * *") return 6 * 60 * 60 * 1000; // every 6h
  if (schedule === "0 0 * * *") return 24 * 60 * 60 * 1000; // daily
  return 60 * 60 * 1000; // fallback 1h
}
