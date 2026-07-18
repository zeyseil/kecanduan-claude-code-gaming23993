import { errorMessage } from "./comics";
import { apiFetch } from "./client";

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787";

export interface AgentProcessInput {
  teks_input: string;
  google_api_key: string;
}

/** Balasan Langflow diteruskan apa adanya (bentuk outputs/session_id version-dependent). */
export async function processAgentText(input: AgentProcessInput): Promise<unknown> {
  const res = await apiFetch(`${BASE_URL}/agent/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json();
}
