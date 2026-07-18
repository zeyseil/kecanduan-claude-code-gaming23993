import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

// Guard for browser-facing routes (/comics, /agent/process): looks up the
// bearer token against AUTH_TOKENS KV (token -> user_id). This is the only
// auth layer now — the shared-secret guard for inbound Langflow calls went
// away with Langflow itself (agent tools are in-process, see src/agent/).
export const userAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string } }> =
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return c.json({ error: "Token tidak ditemukan" }, 401);
    }

    const userId = await c.env.AUTH_TOKENS.get(token);
    if (!userId) {
      return c.json({ error: "Token tidak valid" }, 401);
    }

    c.set("userId", userId);
    await next();
  };
