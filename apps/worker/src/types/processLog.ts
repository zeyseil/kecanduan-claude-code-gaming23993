export type AiAction = "created" | "updated" | "ambiguous";

export const AI_ACTIONS: readonly AiAction[] = ["created", "updated", "ambiguous"];

// Mirrors the process_log schema in SPEC.md §5 / TOOL_CONTRACTS.md §2.5.
export interface ProcessLogEntry {
  input_text: string;
  ai_action: AiAction;
  target_comic_id: string | null;
  confirmed: boolean;
}
