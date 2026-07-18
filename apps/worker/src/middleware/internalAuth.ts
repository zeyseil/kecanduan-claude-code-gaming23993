import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";

// Shared guard for all /internal/tools/* routes (TOOL_CONTRACTS.md "Autentikasi
// internal"): X-Internal-Secret must match the Worker secret (configured fixed
// per Tool component in Langflow, never LLM-supplied), and X-User-Id must be
// present (fixed per-run via tweaks, not agent-chosen).
export const internalAuth: MiddlewareHandler<{ Bindings: Env; Variables: { userId: string } }> =
  async (c, next) => {
    const secret = c.req.header("X-Internal-Secret");
    if (!secret || secret !== c.env.INTERNAL_TOOLS_SECRET) {
      return c.json({ error: "X-Internal-Secret tidak valid" }, 401);
    }

    const userId = c.req.header("X-User-Id");
    if (!userId || userId.trim() === "") {
      return c.json({ error: "X-User-Id wajib diisi" }, 400);
    }

    c.set("userId", userId);
    await next();
  };
