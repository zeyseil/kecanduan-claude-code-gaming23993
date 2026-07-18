import { errorMessage } from "./comics";
import { apiFetch } from "./client";

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787";

export interface AgentProcessInput {
  teks_input: string;
  google_api_key: string;
}

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

/**
 * Balasan dari orkestrasi agent di Worker. Bentuknya ditentukan Worker sendiri
 * (`src/agent/runAgent.ts`), bukan pihak ketiga — jadi stabil dan bisa diketik.
 */
export interface AgentResult {
  message: string;
  tool_calls: AgentToolCall[];
}

export async function processAgentText(input: AgentProcessInput): Promise<AgentResult> {
  const res = await apiFetch(`${BASE_URL}/agent/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<AgentResult>;
}
