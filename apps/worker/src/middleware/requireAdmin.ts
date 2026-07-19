import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import type { Role } from "../lib/authValue";

// Must run after userAuth (needs c.get("role")). This is the real gate for the
// admin dashboard — the frontend RequireAdmin guard is only a UX convenience.
export const requireAdmin: MiddlewareHandler<{
  Bindings: Env;
  Variables: { userId: string; role: Role };
}> = async (c, next) => {
  if (c.get("role") !== "admin") {
    return c.json({ error: "Butuh akses admin" }, 403);
  }
  await next();
};
