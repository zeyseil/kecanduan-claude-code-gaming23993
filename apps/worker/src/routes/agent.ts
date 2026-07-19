import { Hono } from "hono";
import type { Env } from "../env";
import { userAuth } from "../middleware/userAuth";
import { rateLimit } from "../middleware/rateLimit";
import type { Role } from "../lib/authValue";
import { runAgent, AgentLoopError } from "../agent/runAgent";
import { GeminiError, listModels } from "../agent/geminiClient";
import { buildModelOptions, type ListedModel } from "../agent/models";

interface AgentProcessBody {
  teks_input?: unknown;
  google_api_key?: unknown;
  model?: unknown;
}

interface AgentModelsBody {
  google_api_key?: unknown;
}

export const agent = new Hono<{ Bindings: Env; Variables: { userId: string; role: Role } }>();

agent.use("/process", userAuth, rateLimit);
agent.use("/models", userAuth, rateLimit);

/** Gemini's raw errors are opaque to an end user ("Gemini menolak permintaan"
 * says nothing actionable), so the common failures get a plain explanation. */
function explainGeminiError(err: GeminiError): string {
  if (err.status === 429) {
    return "Kuota harian API key Gemini kamu sudah habis. Free tier dibatasi per model per hari, dan satu proses memakai beberapa request. Coba lagi besok, ganti API key, atau set GEMINI_MODEL ke model lain.";
  }
  if (err.status === 503) {
    return "Model Gemini sedang penuh (high demand). Ini biasanya sementara — coba lagi sebentar lagi.";
  }
  if (err.status === 400 || err.status === 403) {
    return "API key Gemini ditolak. Pastikan key-nya benar dan aktif di aistudio.google.com/apikey.";
  }
  if (err.status === 404) {
    return "Model Gemini tidak ditemukan — kemungkinan namanya sudah berubah. Set GEMINI_MODEL ke model yang berlaku.";
  }
  return err.message;
}

agent.post("/process", async (c) => {
  const body = await c.req.json<AgentProcessBody>().catch(() => ({}) as AgentProcessBody);

  if (typeof body.teks_input !== "string" || body.teks_input.trim() === "") {
    return c.json({ error: "teks_input wajib diisi" }, 400);
  }
  if (typeof body.google_api_key !== "string" || body.google_api_key.trim() === "") {
    return c.json({ error: "google_api_key wajib diisi" }, 400);
  }
  // Optional; when present it must be a real string, not an empty one.
  if (body.model !== undefined && (typeof body.model !== "string" || body.model.trim() === "")) {
    return c.json({ error: "model harus berupa string non-kosong kalau diisi" }, 400);
  }

  try {
    // The user's Google API key is used for this request only — never stored.
    const result = await runAgent({
      env: c.env,
      userId: c.get("userId"),
      text: body.teks_input,
      apiKey: body.google_api_key,
      model: typeof body.model === "string" ? body.model : undefined,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof GeminiError) {
      return c.json(
        { error: explainGeminiError(err), gemini_status: err.status, detail: err.detail },
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

// Lists the Gemini models the user's own API key can reach, merged with the
// curated defaults. The key is sent in the body (never a query string) and
// used for this request only — never stored.
agent.post("/models", async (c) => {
  const body = await c.req.json<AgentModelsBody>().catch(() => ({}) as AgentModelsBody);

  if (typeof body.google_api_key !== "string" || body.google_api_key.trim() === "") {
    return c.json({ error: "google_api_key wajib diisi" }, 400);
  }

  try {
    const listed = (await listModels(body.google_api_key)) as ListedModel[];
    return c.json({ models: buildModelOptions(listed) });
  } catch (err) {
    if (err instanceof GeminiError) {
      return c.json(
        { error: explainGeminiError(err), gemini_status: err.status, detail: err.detail },
        502,
      );
    }
    console.error("agent/models gagal:", err);
    return c.json({ error: `Gagal mengambil daftar model: ${String(err)}` }, 500);
  }
});
