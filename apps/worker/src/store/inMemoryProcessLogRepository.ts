import type { ProcessLogEntry } from "../types/processLog";
import type { ProcessLogRepository } from "./processLogRepository";

// Test-only repository, mirrors inMemoryComicRepository's shape/semantics.
const logsByUser = new Map<string, Array<ProcessLogEntry & { ts: string }>>();

export const inMemoryProcessLogRepository: ProcessLogRepository = {
  async insertLog(userId, entry) {
    const list = logsByUser.get(userId) ?? [];
    list.push({ ...entry, ts: new Date().toISOString() });
    logsByUser.set(userId, list);
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
