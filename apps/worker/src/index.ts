import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { comics } from "./routes/comics";
import { agent } from "./routes/agent";
import { scheduled } from "./scheduled";

export const app = new Hono<{ Bindings: Env }>();

const DEV_ORIGIN = "http://localhost:5173";

/** Origin diambil dari env supaya deploy production bisa dipersempit tanpa
 * ubah kode. Kosong = dev lokal saja. Dibangun per-request karena `env` baru
 * tersedia di dalam handler, bukan saat modul dimuat. */
app.use("*", (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const origins = allowed.length > 0 ? allowed : [DEV_ORIGIN];
  return cors({ origin: origins })(c, next);
});

app.get("/", (c) => c.json({ name: "komik-tracker-worker", status: "ok" }));
app.route("/comics", comics);
app.route("/agent", agent);

// Object export (not the bare Hono app) so the cron `scheduled` handler is
// registered alongside `fetch`. See scheduled.ts + [triggers] in wrangler.toml.
export default { fetch: app.fetch, scheduled };

// Durable Object class must be exported from the entry module for wrangler
// to bind it (see wrangler.toml [[durable_objects.bindings]]).
export { RateLimiter } from "./durable-objects/RateLimiter";
export { UserRateLimiter } from "./durable-objects/UserRateLimiter";
