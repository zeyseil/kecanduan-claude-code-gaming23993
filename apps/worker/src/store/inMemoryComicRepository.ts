import type { Comic } from "../types/comic";
import type { ComicRepository } from "./comicRepository";
import { rankCandidates } from "./fuzzyMatch";

// Test-only repository: in-memory, keyed by user_id. Mirrors the old stub
// store's semantics so comicStore.test.ts stays a fast, dependency-free unit test.
const comicsByUser = new Map<string, Comic[]>();

function bucket(userId: string): Comic[] {
  let list = comicsByUser.get(userId);
  if (!list) {
    list = [];
    comicsByUser.set(userId, list);
  }
  return list;
}

export const inMemoryComicRepository: ComicRepository = {
  async listComics(userId) {
    return bucket(userId).slice();
  },

  async insertComic(userId, comic) {
    bucket(userId).push(comic);
    return comic;
  },

  async findComic(userId, comicId) {
    return bucket(userId).find((c) => c.comic_id === comicId);
  },

  async updateComic(userId, comicId, patch) {
    const comic = bucket(userId).find((c) => c.comic_id === comicId);
    if (!comic) return undefined;
    Object.assign(comic, patch, { updated_at: new Date().toISOString() });
    return comic;
  },

  async deleteComic(userId, comicId) {
    const list = bucket(userId);
    const index = list.findIndex((c) => c.comic_id === comicId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  },

  async searchComics(userId, candidateTitle) {
    return rankCandidates(bucket(userId), candidateTitle);
  },

  async countComicsPerUser() {
    return [...comicsByUser.entries()]
      .map(([user_id, list]) => ({ user_id, count: list.length }))
      .filter((entry) => entry.count > 0);
  },
};

/** Test-only: reset all state between test cases. */
export function resetInMemoryStore(): void {
  comicsByUser.clear();
}
