import type { Comic } from "../types/comic";

// Stub in-memory storage keyed by user_id — replace with Astra DB access later.
// Module-level state resets on every Worker cold start; not durable.
const comicsByUser = new Map<string, Comic[]>();

function bucket(userId: string): Comic[] {
  let list = comicsByUser.get(userId);
  if (!list) {
    list = [];
    comicsByUser.set(userId, list);
  }
  return list;
}

export function listComics(userId: string): Comic[] {
  return bucket(userId).slice();
}

export function insertComic(userId: string, comic: Comic): Comic {
  bucket(userId).push(comic);
  return comic;
}

export function findComic(userId: string, comicId: string): Comic | undefined {
  return bucket(userId).find((c) => c.comic_id === comicId);
}

export function updateComic(
  userId: string,
  comicId: string,
  patch: Partial<Omit<Comic, "comic_id" | "created_at">>,
): Comic | undefined {
  const comic = findComic(userId, comicId);
  if (!comic) return undefined;
  Object.assign(comic, patch, { updated_at: new Date().toISOString() });
  return comic;
}

/** Test-only: reset all state between test cases. */
export function resetStore(): void {
  comicsByUser.clear();
}
