import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db, schema } from "../db/client";
import { adminAuth } from "../lib/apiKey";

export const webhooksRouter = new Hono();
webhooksRouter.use("*", adminAuth);

const CreateWebhookSchema = z.object({
  url: z.url(),
  repoFilter: z.array(z.string()).optional().default([]),
  secret: z.string().min(16).optional(),
});

/**
 * POST /v1/admin/webhooks — register a new webhook
 */
webhooksRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid payload", details: parsed.error.flatten() }, 400);
  }

  const secret = parsed.data.secret ?? randomBytes(32).toString("hex");

  const [created] = await db
    .insert(schema.webhooks)
    .values({
      url: parsed.data.url,
      secret,
      repoFilter: parsed.data.repoFilter,
      enabled: true,
      failureCount: 0,
    })
    .returning();

  return c.json({
    id: created!.id,
    url: created!.url,
    secret: created!.secret,
    repoFilter: created!.repoFilter,
  }, 201);
});

/**
 * GET /v1/admin/webhooks — list all
 */
webhooksRouter.get("/", async (c) => {
  const all = await db.select().from(schema.webhooks);
  return c.json({
    webhooks: all.map((w) => ({
      id: w.id,
      url: w.url,
      repoFilter: w.repoFilter,
      enabled: w.enabled,
      lastDeliveryAt: w.lastDeliveryAt,
      failureCount: w.failureCount,
    })),
  });
});

/**
 * DELETE /v1/admin/webhooks/:id
 */
webhooksRouter.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const deleted = await db.delete(schema.webhooks).where(eq(schema.webhooks.id, id)).returning();
  if (deleted.length === 0) return c.json({ error: "Not found" }, 404);

  return c.json({ ok: true });
});
