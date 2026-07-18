import type { ProcessLogEntry } from "../types/processLog";

export interface ProcessLogRepository {
  insertLog(userId: string, entry: ProcessLogEntry): Promise<void>;
}
