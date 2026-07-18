import { Hono } from "hono";

interface AgentProcessBody {
  teks_input?: unknown;
  google_api_key?: unknown;
}

export const agent = new Hono();

// Stub: Langflow belum di-deploy. Titik integrasi nanti akan proxy body ini
// ke Langflow /run dengan google_api_key dikirim sebagai tweak, tidak disimpan.
agent.post("/process", async (c) => {
  const body = await c.req.json<AgentProcessBody>().catch(() => ({}) as AgentProcessBody);

  if (typeof body.teks_input !== "string" || body.teks_input.trim() === "") {
    return c.json({ error: "teks_input wajib diisi" }, 400);
  }
  if (typeof body.google_api_key !== "string" || body.google_api_key.trim() === "") {
    return c.json({ error: "google_api_key wajib diisi" }, 400);
  }

  return c.json(
    {
      status: "not_implemented",
      message: "Langflow belum terintegrasi — endpoint ini masih stub.",
    },
    501,
  );
});
