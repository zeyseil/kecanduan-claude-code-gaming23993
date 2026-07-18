import { Hono } from "hono";
import { comics } from "./routes/comics";
import { agent } from "./routes/agent";

const app = new Hono();

app.get("/", (c) => c.json({ name: "komik-tracker-worker", status: "ok" }));
app.route("/comics", comics);
app.route("/agent", agent);

export default app;
