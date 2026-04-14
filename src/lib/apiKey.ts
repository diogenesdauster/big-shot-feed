import type { MiddlewareHandler } from "hono";
import { env } from "../env";

/**
 * Middleware that requires `x-api-key` header matching ADMIN_API_KEY.
 */
export const adminAuth: MiddlewareHandler = async (c, next) => {
  const key = c.req.header("x-api-key");
  if (!key || key !== env.ADMIN_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
