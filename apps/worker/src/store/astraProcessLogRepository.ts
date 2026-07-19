import { DataAPIClient } from "@datastax/astra-db-ts";
import type { Env } from "../env";
import type { AiAction, ProcessLogEntry } from "../types/processLog";
import { AI_ACTIONS } from "../types/processLog";
import type { ProcessLogRepository, ProcessLogSummary } from "./processLogRepository";

function emptyByAction(): Record<AiAction, number> {
  return Object.fromEntries(AI_ACTIONS.map((a) => [a, 0])) as Record<AiAction, number>;
}

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

    async listLogs(userId, limit) {
      const docs = await collection
        .find({ user_id: userId }, { sort: { ts: -1 }, limit })
        .toArray();
      return docs.map((doc) => {
        const entry = { ...doc };
        delete (entry as { user_id?: string }).user_id;
        delete (entry as { _id?: unknown })._id;
        return entry as ProcessLogEntry & { ts: string };
      });
    },

    async summarizeLogs(sinceIso): Promise<ProcessLogSummary> {
      // Projection pulls only what the aggregate needs — input_text never
      // leaves the store for this cross-user query.
      const docs = await collection
        .find(
          { ts: { $gte: sinceIso } },
          { projection: { user_id: 1, ts: 1, ai_action: 1 } },
        )
        .toArray();

      const byAction = emptyByAction();
      const lastByUser = new Map<string, string>();
      for (const doc of docs as Array<{ user_id: string; ts: string; ai_action: AiAction }>) {
        if (doc.ai_action in byAction) byAction[doc.ai_action] += 1;
        const prev = lastByUser.get(doc.user_id);
        if (!prev || doc.ts > prev) lastByUser.set(doc.user_id, doc.ts);
      }

      return {
        total: docs.length,
        byAction,
        lastActivityPerUser: [...lastByUser.entries()].map(([user_id, last_at]) => ({
          user_id,
          last_at,
        })),
      };
    },
  };
}
