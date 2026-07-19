import type { AiAction, ProcessLogEntry } from "../types/processLog";
import { AI_ACTIONS } from "../types/processLog";
import type { ProcessLogRepository, ProcessLogSummary } from "./processLogRepository";

// Test-only repository, mirrors inMemoryComicRepository's shape/semantics.
const logsByUser = new Map<string, Array<ProcessLogEntry & { ts: string }>>();

function emptyByAction(): Record<AiAction, number> {
  return Object.fromEntries(AI_ACTIONS.map((a) => [a, 0])) as Record<AiAction, number>;
}

export const inMemoryProcessLogRepository: ProcessLogRepository = {
  async insertLog(userId, entry) {
    const list = logsByUser.get(userId) ?? [];
    list.push({ ...entry, ts: new Date().toISOString() });
    logsByUser.set(userId, list);
  },

  async listLogs(userId, limit) {
    const list = logsByUser.get(userId) ?? [];
    return [...list].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
  },

  async summarizeLogs(sinceIso): Promise<ProcessLogSummary> {
    const byAction = emptyByAction();
    const lastByUser = new Map<string, string>();
    let total = 0;
    for (const [userId, list] of logsByUser.entries()) {
      for (const entry of list) {
        if (entry.ts < sinceIso) continue;
        total += 1;
        if (entry.ai_action in byAction) byAction[entry.ai_action] += 1;
        const prev = lastByUser.get(userId);
        if (!prev || entry.ts > prev) lastByUser.set(userId, entry.ts);
      }
    }
    return {
      total,
      byAction,
      lastActivityPerUser: [...lastByUser.entries()].map(([user_id, last_at]) => ({
        user_id,
        last_at,
      })),
    };
  },
};

/** Test-only: reset all state between test cases. */
export function resetInMemoryProcessLog(): void {
  logsByUser.clear();
}

/** Test-only: inspect what was logged for a user. */
export function getLoggedEntries(userId: string): Array<ProcessLogEntry & { ts: string }> {
  return logsByUser.get(userId) ?? [];
}
