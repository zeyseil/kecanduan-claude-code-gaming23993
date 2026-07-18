import { DataAPIClient } from "@datastax/astra-db-ts";
import type { Env } from "../env";
import type { Comic } from "../types/comic";

interface ComicDocument extends Comic {
  user_id: string;
}

// Built per-call (not cached in module scope) — Workers isolates can be
// reused across unrelated requests, so we avoid holding shared client state.
export function getCollection(env: Env) {
  const client = new DataAPIClient(env.ASTRA_DB_APPLICATION_TOKEN);
  const db = client.db(env.ASTRA_DB_API_ENDPOINT);
  return db.collection<ComicDocument>(env.ASTRA_DB_COLLECTION);
}
