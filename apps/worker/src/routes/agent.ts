import { Hono } from "hono";
import type { Env } from "../env";
import { userAuth } from "../middleware/userAuth";
import { rateLimit } from "../middleware/rateLimit";

interface AgentProcessBody {
  teks_input?: unknown;
  google_api_key?: unknown;
}

export const agent = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

agent.use("/process", userAuth, rateLimit);

// Component ids referenced here must match the actual node ids in the user's
// Langflow flow ("komik-tracker" project, flow "yay") — they're how `tweaks`
// targets specific nodes. Langflow assigns a random suffix per node, so these
// are NOT stable across a from-scratch rebuild; update here if the flow is
// ever rebuilt. See langflow/README.md.
//
// "CustomComponent-REPLACE-ME-set-cover" is a PLACEHOLDER for set_cover — this
// tool didn't exist yet when the other 5 ids were captured from the live
// flow. It must be added manually as a new Custom Component node in Langflow
// (see langflow/README.md), and this constant updated with the real id
// Langflow assigns once that node is created — otherwise the internal_secret/
// app_user_id tweaks for it silently won't apply.
const AGENT_COMPONENT_ID = "Agent-UVDzm";
const TOOL_COMPONENT_IDS = [
  "CustomComponent-zI7yQ", // cari_komik_mirip
  "CustomComponent-urIVs", // buat_entry_baru
  "CustomComponent-Dn6gI", // update_chapter
  "CustomComponent-TiPBs", // cari_cover_mangadex
  "CustomComponent-XuCo4", // log_proses
  "CustomComponent-REPLACE-ME-set-cover", // set_cover — PLACEHOLDER, see comment above
] as const;

agent.post("/process", async (c) => {
  const body = await c.req.json<AgentProcessBody>().catch(() => ({}) as AgentProcessBody);

  if (typeof body.teks_input !== "string" || body.teks_input.trim() === "") {
    return c.json({ error: "teks_input wajib diisi" }, 400);
  }
  if (typeof body.google_api_key !== "string" || body.google_api_key.trim() === "") {
    return c.json({ error: "google_api_key wajib diisi" }, 400);
  }

  // google_api_key is forwarded to Langflow per-run via tweaks — never stored.
  const tweaks: Record<string, Record<string, unknown>> = {
    [AGENT_COMPONENT_ID]: { api_key: body.google_api_key },
  };
  for (const toolId of TOOL_COMPONENT_IDS) {
    tweaks[toolId] = {
      internal_secret: c.env.INTERNAL_TOOLS_SECRET,
      // Field name is "app_user_id", not "user_id" — Langflow silently
      // overrides any field literally named "user_id" with its own platform
      // user id, ignoring both default value and tweaks. See langflow/README.md.
      app_user_id: c.get("userId"),
    };
  }

  let langflowRes: Response;
  try {
    langflowRes = await fetch(c.env.LANGFLOW_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": c.env.LANGFLOW_API_KEY,
      },
      body: JSON.stringify({
        input_value: body.teks_input,
        output_type: "chat",
        input_type: "chat",
        tweaks,
      }),
    });
  } catch {
    return c.json({ error: "Tidak bisa menghubungi Langflow" }, 502);
  }

  if (!langflowRes.ok) {
    const detail = await langflowRes.text().catch(() => "");
    return c.json(
      { error: "Langflow gagal memproses permintaan", langflow_status: langflowRes.status, detail },
      502,
    );
  }

  const langflowBody = await langflowRes.json();
  return c.json(langflowBody);
});
