import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { acquireUserSlot } from "../durable-objects/UserRateLimiter";

// Must run after userAuth (needs c.get("userId")). Guards browser/agent-facing
// routes only — /internal/tools/* is called by Langflow itself, not the user
// directly, and /fetch-cover already has its own MangaDex throttle.
export const rateLimit: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string } }> =
  async (c, next) => {
    const allowed = await acquireUserSlot(c.env.USER_RATE_LIMITER, c.get("userId"));
    if (!allowed) {
      return c.json({ error: "Terlalu banyak request, coba lagi sebentar." }, 429);
    }
    await next();
  };
