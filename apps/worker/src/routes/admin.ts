import { Hono } from "hono";
import type { Env } from "../env";
import type { Role } from "../lib/authValue";
import { parseAuthValue } from "../lib/authValue";
import { userAuth } from "../middleware/userAuth";
import { rateLimit } from "../middleware/rateLimit";
import { requireAdmin } from "../middleware/requireAdmin";
import { getComicStore } from "../store/comicStore";
import { getProcessLogStore } from "../store/processLogStore";

export const admin = new Hono<{
  Bindings: Env;
  Variables: { userId: string; role: Role };
}>();

// requireAdmin is the real gate; userAuth populates role, rateLimit protects it.
admin.use("*", userAuth, rateLimit, requireAdmin);

const DEFAULT_LOG_LIMIT = 50;
const HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Never expose full tokens to the browser — 4 head + 3 tail, rest elided. */
function maskToken(token: string): string {
  if (token.length <= 10) return `${token.slice(0, 2)}…`;
  return `${token.slice(0, 4)}…${token.slice(-3)}`;
}

/** New token: 24 random bytes as hex (48 chars). */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Live snapshot of system health — a real Astra read (reusing the keep-alive
// pattern from scheduled.ts) plus 24h aggregates. Never 500s on a down DB;
// reports { astra: "down" } instead so the dashboard stays usable.
admin.get("/health", async (c) => {
  const sinceIso = new Date(Date.now() - HEALTH_WINDOW_MS).toISOString();

  let astra: "ok" | "down" = "ok";
  let astraDetail: string | undefined;
  let summary = null as Awaited<ReturnType<ReturnType<typeof getProcessLogStore>["summarizeLogs"]>> | null;
  try {
    // One cheap read proves the DB is reachable.
    await getComicStore(c.env).listComics("__healthcheck__");
    summary = await getProcessLogStore(c.env).summarizeLogs(sinceIso);
  } catch (err) {
    astra = "down";
    astraDetail = err instanceof Error ? err.message : String(err);
  }

  return c.json({
    astra,
    astra_detail: astraDetail,
    gemini_model: c.env.GEMINI_MODEL ?? "(default)",
    bindings: {
      auth_tokens: Boolean(c.env.AUTH_TOKENS),
      rate_limiter: Boolean(c.env.RATE_LIMITER),
      user_rate_limiter: Boolean(c.env.USER_RATE_LIMITER),
    },
    activity_24h: summary,
  });
});

// User + token list. Metadata only for other users (comic count + last
// activity) — never their comic titles or prompt text. Tokens are masked.
admin.get("/users", async (c) => {
  const list = await c.env.AUTH_TOKENS.list();
  const [counts, summary] = await Promise.all([
    getComicStore(c.env).countComicsPerUser(),
    getProcessLogStore(c.env).summarizeLogs("0000"), // all-time, counts only
  ]);
  const countByUser = new Map(counts.map((r) => [r.user_id, r.count]));
  const lastByUser = new Map(summary.lastActivityPerUser.map((r) => [r.user_id, r.last_at]));

  const users = await Promise.all(
    list.keys.map(async (key) => {
      const raw = await c.env.AUTH_TOKENS.get(key.name);
      const principal = raw ? parseAuthValue(raw) : { userId: "?", role: "user" as Role };
      return {
        token_masked: maskToken(key.name),
        user_id: principal.userId,
        role: principal.role,
        comic_count: countByUser.get(principal.userId) ?? 0,
        last_activity: lastByUser.get(principal.userId) ?? null,
      };
    }),
  );

  return c.json({ users, list_complete: list.list_complete });
});

// Issue a new user-role token. The full token is returned ONCE here and never
// readable again (KV stores it, /users only ever shows a masked form). Role is
// hard-coded to "user" — admin promotion is wrangler-only, by design.
admin.post("/tokens", async (c) => {
  const body = await c.req.json<{ user_id?: unknown }>().catch(() => ({}) as { user_id?: unknown });
  if (typeof body.user_id !== "string" || body.user_id.trim() === "") {
    return c.json({ error: "user_id wajib diisi" }, 400);
  }

  const token = generateToken();
  await c.env.AUTH_TOKENS.put(
    token,
    JSON.stringify({ user_id: body.user_id.trim(), role: "user" }),
  );

  return c.json({ token, user_id: body.user_id.trim(), role: "user" }, 201);
});

// Revoke access for a user_id. Works by user_id (not the raw token) because the
// UI only ever sees masked tokens — never the full value. Deletes every
// user-role token whose parsed user_id matches; admin tokens are left untouched
// (admin revocation stays wrangler-only, which also prevents self-lockout).
admin.delete("/users/:userId/tokens", async (c) => {
  const userId = c.req.param("userId");
  const list = await c.env.AUTH_TOKENS.list();

  let revoked = 0;
  let skippedAdmin = 0;
  for (const key of list.keys) {
    const raw = await c.env.AUTH_TOKENS.get(key.name);
    if (!raw) continue;
    const principal = parseAuthValue(raw);
    if (principal.userId !== userId) continue;
    if (principal.role === "admin") {
      skippedAdmin += 1;
      continue;
    }
    await c.env.AUTH_TOKENS.delete(key.name);
    revoked += 1;
  }

  if (revoked === 0 && skippedAdmin === 0) {
    return c.json({ error: "user_id tidak ditemukan" }, 404);
  }
  return c.json({ revoked, skipped_admin: skippedAdmin });
});

// The admin's OWN recent activity — full detail, since it's their own data.
// Other users' logs are never listed here (privacy decision).
admin.get("/logs", async (c) => {
  const logs = await getProcessLogStore(c.env).listLogs(c.get("userId"), DEFAULT_LOG_LIMIT);
  return c.json({ logs });
});
