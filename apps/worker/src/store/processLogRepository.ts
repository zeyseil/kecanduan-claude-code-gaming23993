import type { AiAction, ProcessLogEntry } from "../types/processLog";

/** Admin health aggregate — counts only, never any input_text. */
export interface ProcessLogSummary {
  total: number;
  byAction: Record<AiAction, number>;
  lastActivityPerUser: Array<{ user_id: string; last_at: string }>;
}

export interface ProcessLogRepository {
  insertLog(userId: string, entry: ProcessLogEntry): Promise<void>;
  /** Detail log for ONE user — used only for the admin's own activity view. */
  listLogs(userId: string, limit: number): Promise<Array<ProcessLogEntry & { ts: string }>>;
  /** Cross-user aggregate for the admin dashboard: pure counts + last-activity
   * timestamps. Deliberately returns no input_text so other users' prompts
   * never leave the store. */
  summarizeLogs(sinceIso: string): Promise<ProcessLogSummary>;
}
