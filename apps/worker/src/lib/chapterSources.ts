// Registry of "Cari link chapter berikutnya" sources. Each source needs its own
// resolver (search-by-title + a chapter-list API to build a per-chapter reader
// URL) — adding one is real backend work, not just a list entry. Kept mirrored
// on the web client as CHAPTER_SOURCES in apps/web/src/lib/api/comics.ts.

import type { Env } from "../env";
import { findNextChapterUrl, type NextChapterResult } from "./comickChapters";
import { findNextChapterUrlMangaDex } from "./mangadexChapters";

export const CHAPTER_SOURCES = [
  { id: "comick", label: "comick.dev" },
  { id: "mangadex", label: "MangaDex" },
] as const;

export type ChapterSourceId = (typeof CHAPTER_SOURCES)[number]["id"];

export function isChapterSourceId(value: unknown): value is ChapterSourceId {
  return CHAPTER_SOURCES.some((s) => s.id === value);
}

/** Dispatches to the resolver for `source`. Assumes `source` is already validated
 * (see isChapterSourceId) — callers reject unknown ids with a 400 first. */
export function resolveNextChapter(
  source: ChapterSourceId,
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  switch (source) {
    case "mangadex":
      return findNextChapterUrlMangaDex(title, afterChapter, env);
    case "comick":
    default:
      return findNextChapterUrl(title, afterChapter, env);
  }
}
