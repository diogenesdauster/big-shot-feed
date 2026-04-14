import { createHmac } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/client";
import { log, logWarn, logError } from "./logger";
import type { Webhook } from "../db/schema";

const MODULE = "webhook";

export interface WebhookPayload {
  event: "sync.complete";
  repo: string;
  added: string[];
  modified: string[];
  deleted: string[];
  commitSha: string;
  timestamp: string;
}

/**
 * Delivers a webhook payload with HMAC signature.
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function deliverWebhook(webhook: Webhook, payload: WebhookPayload): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const resp = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bigshot-signature": `sha256=${signature}`,
          "x-bigshot-event": payload.event,
          "User-Agent": "big-shot-feed/1.0",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (resp.ok) {
        log(MODULE, "Webhook delivered", { url: webhook.url, status: resp.status, attempt });
        await db
          .update(schema.webhooks)
          .set({ lastDeliveryAt: new Date(), failureCount: 0 })
          .where(eq(schema.webhooks.id, webhook.id));
        return true;
      }

      lastError = `HTTP ${resp.status} ${resp.statusText}`;
      logWarn(MODULE, "Webhook non-2xx response", { url: webhook.url, status: resp.status, attempt });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      logWarn(MODULE, "Webhook delivery error", { url: webhook.url, error: lastError, attempt });
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  logError(MODULE, "Webhook delivery failed after retries", { url: webhook.url, error: lastError });
  await db
    .update(schema.webhooks)
    .set({ failureCount: webhook.failureCount + 1 })
    .where(eq(schema.webhooks.id, webhook.id));
  return false;
}

/**
 * Notifies all enabled webhooks about a sync event.
 * Filters by repo if the webhook has a repoFilter.
 */
export async function notifyWebhooks(payload: WebhookPayload): Promise<void> {
  const all = await db.select().from(schema.webhooks).where(eq(schema.webhooks.enabled, true));

  const matching = all.filter((wh) => {
    const filter = wh.repoFilter ?? [];
    return filter.length === 0 || filter.includes(payload.repo);
  });

  if (matching.length === 0) {
    log(MODULE, "No webhooks matching event", { repo: payload.repo });
    return;
  }

  log(MODULE, `Notifying ${matching.length} webhooks`, { event: payload.event, repo: payload.repo });
  await Promise.all(matching.map((wh) => deliverWebhook(wh, payload)));
}
