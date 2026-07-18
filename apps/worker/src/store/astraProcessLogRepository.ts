import { DataAPIClient } from "@datastax/astra-db-ts";
import type { Env } from "../env";
import type { ProcessLogEntry } from "../types/processLog";
import type { ProcessLogRepository } from "./processLogRepository";

interface ProcessLogDocument extends ProcessLogEntry {
  user_id: string;
  ts: string;
}

// Built per-call for the same reason as astraClient.getCollection — Workers
// isolates can be reused across unrelated requests.
function getLogCollection(env: Env) {
  const client = new DataAPIClient(env.ASTRA_DB_APPLICATION_TOKEN);
  const db = client.db(env.ASTRA_DB_API_ENDPOINT);
  return db.collection<ProcessLogDocument>(env.PROCESS_LOG_COLLECTION);
}

export function createAstraProcessLogRepository(env: Env): ProcessLogRepository {
  const collection = getLogCollection(env);

  return {
    async insertLog(userId, entry) {
      await collection.insertOne({
        ...entry,
        user_id: userId,
        ts: new Date().toISOString(),
      });
    },
  };
}
