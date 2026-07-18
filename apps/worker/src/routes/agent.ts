import { Hono } from "hono";
import type { Env } from "../env";
import { userAuth } from "../middleware/userAuth";
import { rateLimit } from "../middleware/rateLimit";
import { runAgent, AgentLoopError } from "../agent/runAgent";
import { GeminiError } from "../agent/geminiClient";

interface AgentProcessBody {
  teks_input?: unknown;
  google_api_key?: unknown;
}

export const agent = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

agent.use("/process", userAuth, rateLimit);

agent.post("/process", async (c) => {
  const body = await c.req.json<AgentProcessBody>().catch(() => ({}) as AgentProcessBody);

  if (typeof body.teks_input !== "string" || body.teks_input.trim() === "") {
    return c.json({ error: "teks_input wajib diisi" }, 400);
  }
  if (typeof body.google_api_key !== "string" || body.google_api_key.trim() === "") {
    return c.json({ error: "google_api_key wajib diisi" }, 400);
  }

  try {
    // The user's Google API key is used for this request only — never stored.
    const result = await runAgent({
      env: c.env,
      userId: c.get("userId"),
      text: body.teks_input,
      apiKey: body.google_api_key,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof GeminiError) {
      return c.json(
        { error: err.message, gemini_status: err.status, detail: err.detail },
        502,
      );
    }
    if (err instanceof AgentLoopError) {
      return c.json({ error: err.message }, 502);
    }
    console.error("agent/process gagal:", err);
    return c.json({ error: `Gagal memproses teks: ${String(err)}` }, 500);
  }
});
