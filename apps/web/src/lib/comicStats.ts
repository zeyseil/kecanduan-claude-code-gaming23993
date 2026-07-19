import type { Comic, TypeTag } from "../types/comic";
import { TYPE_TAGS } from "../types/comic";

export interface ComicStats {
  total: number;
  ongoing: number;
  completed: number;
  totalChapters: number;
  byType: Record<TypeTag, number>;
}

export function summarizeComics(comics: Comic[]): ComicStats {
  const byType = Object.fromEntries(TYPE_TAGS.map((t) => [t, 0])) as Record<TypeTag, number>;
  let ongoing = 0;
  let completed = 0;
  let totalChapters = 0;

  for (const comic of comics) {
    byType[comic.type_tag] += 1;
    totalChapters += comic.latest_chapter;
    if (comic.status === "ongoing") ongoing += 1;
    else completed += 1;
  }

  return { total: comics.length, ongoing, completed, totalChapters, byType };
}
