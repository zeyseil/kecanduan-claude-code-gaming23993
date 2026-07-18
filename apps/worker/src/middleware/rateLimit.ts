import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { acquireUserSlot } from "../durable-objects/UserRateLimiter";

// Must run after userAuth (needs c.get("userId")). Protects the Worker/Astra
// from a single user hammering it; outbound MangaDex calls have their own
// separate global throttle (see durable-objects/RateLimiter.ts).
export const rateLimit: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string } }> =
  async (c, next) => {
    const allowed = await acquireUserSlot(c.env.USER_RATE_LIMITER, c.get("userId"));
    if (!allowed) {
      return c.json({ error: "Terlalu banyak request, coba lagi sebentar." }, 429);
    }
    await next();
  };
