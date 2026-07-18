import type { Env } from "../env";
import type { ProcessLogRepository } from "./processLogRepository";
import { createAstraProcessLogRepository } from "./astraProcessLogRepository";

/** Factory: resolves the real Astra DB-backed process_log repository from Worker env bindings. */
export function getProcessLogStore(env: Env): ProcessLogRepository {
  return createAstraProcessLogRepository(env);
}
