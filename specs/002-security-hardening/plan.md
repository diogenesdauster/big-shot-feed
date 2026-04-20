# Technical Plan: Security Hardening (big-shot-feed)

**Feature Branch**: `002-security-hardening`
**Spec**: `specs/002-security-hardening/spec.md`

## Implementation

### BF-1: Rate Limiting

Use Hono middleware with in-memory sliding window. Hono has no built-in rate limiter, so we implement one.

```typescript
// src/lib/rateLimit.ts
const windows = new Map<string, number[]>();

export function rateLimitMiddleware(maxRequests: number, windowMs: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const timestamps = windows.get(ip)?.filter(t => t > now - windowMs) ?? [];
    if (timestamps.length >= maxRequests) {
      return c.json({ error: "Too Many Requests" }, 429);
    }
    timestamps.push(now);
    windows.set(ip, timestamps);
    await next();
  };
}
```

Apply: public routes 50/10s, admin routes 10/10s.
