import type { Env } from "../env";
import type { ComicRepository } from "./comicRepository";
import { createAstraComicRepository } from "./astraComicRepository";

/** Factory: resolves the real Astra DB-backed repository from Worker env bindings. */
export function getComicStore(env: Env): ComicRepository {
  return createAstraComicRepository(env);
}
