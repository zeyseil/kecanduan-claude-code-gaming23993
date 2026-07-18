import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { comics } from "./routes/comics";
import { agent } from "./routes/agent";
import { internalTools } from "./routes/internalTools";

export const app = new Hono<{ Bindings: Env }>();

// Origin wildcard untuk dev — belum ada auth/data sensitif nyata.
// TODO: persempit ke origin spesifik sebelum deploy production.
app.use("*", cors());

app.get("/", (c) => c.json({ name: "komik-tracker-worker", status: "ok" }));
app.route("/comics", comics);
app.route("/agent", agent);
app.route("/internal/tools", internalTools);

// Cron-triggered keep-alive: ping the Langflow health endpoint so a Hugging
// Face Space (free tier sleeps after ~48h idle) stays warm. No-op when
// LANGFLOW_HEALTH_URL is unset (e.g. Langflow running locally). Never throws —
// a failed ping must not surface as a Worker error.
async function scheduled(_event: ScheduledController, env: Env): Promise<void> {
  if (!env.LANGFLOW_HEALTH_URL) {
    console.log("keep-alive: LANGFLOW_HEALTH_URL unset, skipping");
    return;
  }
  try {
    const res = await fetch(env.LANGFLOW_HEALTH_URL, { method: "GET" });
    console.log(`keep-alive: ${env.LANGFLOW_HEALTH_URL} -> ${res.status}`);
  } catch (err) {
    console.error(`keep-alive: gagal ping Langflow — ${String(err)}`);
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};

// Durable Object class must be exported from the entry module for wrangler
// to bind it (see wrangler.toml [[durable_objects.bindings]]).
export { RateLimiter } from "./durable-objects/RateLimiter";
export { UserRateLimiter } from "./durable-objects/UserRateLimiter";
