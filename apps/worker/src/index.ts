import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { comics } from "./routes/comics";
import { agent } from "./routes/agent";
import { internalTools } from "./routes/internalTools";

const app = new Hono<{ Bindings: Env }>();

// Origin wildcard untuk dev — belum ada auth/data sensitif nyata.
// TODO: persempit ke origin spesifik sebelum deploy production.
app.use("*", cors());

app.get("/", (c) => c.json({ name: "komik-tracker-worker", status: "ok" }));
app.route("/comics", comics);
app.route("/agent", agent);
app.route("/internal/tools", internalTools);

export default app;

// Durable Object class must be exported from the entry module for wrangler
// to bind it (see wrangler.toml [[durable_objects.bindings]]).
export { RateLimiter } from "./durable-objects/RateLimiter";
export { UserRateLimiter } from "./durable-objects/UserRateLimiter";
