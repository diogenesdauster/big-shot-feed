import { Octokit } from "@octokit/rest";
import { env } from "../env";
import { logWarn } from "../lib/logger";

const MODULE = "github";

export const octokit = new Octokit({
  auth: env.GITHUB_TOKEN || undefined,
  userAgent: "big-shot-feed/1.0",
});

export async function getRateLimit(): Promise<{ remaining: number; reset: Date }> {
  const { data } = await octokit.rateLimit.get();
  return {
    remaining: data.resources.core.remaining,
    reset: new Date(data.resources.core.reset * 1000),
  };
}

/**
 * Checks rate limit and warns if running low (< 100).
 * Returns true if safe to proceed, false if rate limited.
 */
export async function checkRateLimit(): Promise<boolean> {
  try {
    const { remaining, reset } = await getRateLimit();
    if (remaining < 10) {
      logWarn(MODULE, "Rate limit exhausted, waiting until reset", { remaining, reset });
      return false;
    }
    if (remaining < 100) {
      logWarn(MODULE, "Rate limit running low", { remaining, reset });
    }
    return true;
  } catch (err) {
    logWarn(MODULE, "Failed to check rate limit", { error: String(err) });
    return true; // Best-effort, continue
  }
}
