import type { Env } from "./env";
import { getComicStore } from "./store/comicStore";

// Astra DB free tier hibernates a database that sees no traffic for a stretch;
// a hibernated DB adds cold-start latency to the next real request. This
// scheduled handler runs once a day (see [triggers] crons in wrangler.toml) and
// issues one cheap read so the DB is never idle long enough to be parked.
//
// Deliberately mirrors the keep-alive pattern proven earlier in the project:
//   - never throws — an unreachable DB is not a Worker error, just log it;
//   - no-op when Astra env is empty, so `wrangler dev` locally stays quiet.
//
// Note: cron triggers only fire on a DEPLOYED Worker, not under `wrangler dev`
// (use `wrangler dev --test-scheduled` + the /__scheduled route to exercise it).

// Any user id works — we only care that the query touches Astra, not what it
// returns. A dedicated constant keeps intent obvious in logs.
const KEEPALIVE_USER_ID = "__keepalive__";

export async function scheduled(_event: ScheduledController, env: Env): Promise<void> {
  if (!env.ASTRA_DB_API_ENDPOINT || !env.ASTRA_DB_APPLICATION_TOKEN) {
    console.warn("scheduled: env Astra kosong, keep-alive dilewati");
    return;
  }

  try {
    const store = getComicStore(env);
    await store.listComics(KEEPALIVE_USER_ID);
    console.log("scheduled: keep-alive Astra sukses");
  } catch (err) {
    // Log, never throw — a failed ping must not mark the Worker run as errored.
    console.error(`scheduled: keep-alive Astra gagal: ${String(err)}`);
  }
}
