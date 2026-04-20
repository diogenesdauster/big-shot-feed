import type { MiddlewareHandler } from "hono";

const windows = new Map<string, number[]>();

// Cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of windows) {
    const valid = timestamps.filter((t) => t > now - 60_000);
    if (valid.length === 0) windows.delete(key);
    else windows.set(key, valid);
  }
}, 60_000);

/**
 * Hono middleware for rate limiting.
 * @param maxRequests Max requests per window
 * @param windowMs Window duration in ms
 */
export function rateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const timestamps = windows.get(ip)?.filter((t) => t > now - windowMs) ?? [];

    if (timestamps.length >= maxRequests) {
      return c.json({ error: "Too Many Requests" }, 429);
    }

    timestamps.push(now);
    windows.set(ip, timestamps);
    await next();
  };
}
