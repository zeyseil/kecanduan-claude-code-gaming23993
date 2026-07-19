import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { parseAuthValue, type Role } from "../lib/authValue";

// Guard for browser-facing routes (/comics, /agent/process, /admin): looks up
// the bearer token against AUTH_TOKENS KV. The stored value may be a legacy bare
// user_id string or the new JSON {user_id, role} shape — parseAuthValue()
// normalizes both, so old tokens keep working unchanged. This is the only auth
// layer now — the shared-secret guard for inbound Langflow calls went away with
// Langflow itself (agent tools are in-process, see src/agent/).
export const userAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: { userId: string; role: Role };
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return c.json({ error: "Token tidak ditemukan" }, 401);
  }

  const raw = await c.env.AUTH_TOKENS.get(token);
  if (!raw) {
    return c.json({ error: "Token tidak valid" }, 401);
  }

  const principal = parseAuthValue(raw);
  c.set("userId", principal.userId);
  c.set("role", principal.role);
  await next();
};
