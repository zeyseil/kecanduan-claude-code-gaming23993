import { Hono } from "hono";
import { cors } from "hono/cors";
import { comics } from "./routes/comics";
import { agent } from "./routes/agent";

const app = new Hono();

// Origin wildcard untuk dev — belum ada auth/data sensitif nyata.
// TODO: persempit ke origin spesifik sebelum deploy production.
app.use("*", cors());

app.get("/", (c) => c.json({ name: "komik-tracker-worker", status: "ok" }));
app.route("/comics", comics);
app.route("/agent", agent);

export default app;
