/**
 * Bentuk `outputs` balasan Langflow version-dependent (lihat catatan di lib/api/agent.ts) —
 * drill defensif ke path pesan Chat Output, jangan asumsikan struktur stabil.
 */
export function extractAgentMessage(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;

  const outputs = (result as Record<string, unknown>).outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return null;

  const inner = outputs[0];
  if (typeof inner !== "object" || inner === null) return null;
  const innerOutputs = (inner as Record<string, unknown>).outputs;
  if (!Array.isArray(innerOutputs) || innerOutputs.length === 0) return null;

  const chatOutput = innerOutputs[0];
  if (typeof chatOutput !== "object" || chatOutput === null) return null;
  const messageWrapper = (chatOutput as Record<string, unknown>).outputs;
  if (typeof messageWrapper !== "object" || messageWrapper === null) return null;
  const message = (messageWrapper as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;

  const text = (message as Record<string, unknown>).message;
  return typeof text === "string" && text.trim() !== "" ? text : null;
}
