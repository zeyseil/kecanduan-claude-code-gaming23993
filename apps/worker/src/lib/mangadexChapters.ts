// "Cari link chapter berikutnya" — MangaDex resolver, sibling of comickChapters.ts.
// Verified LIVE while implementing (curl against api.mangadex.org):
//   1. GET /chapter?manga={id}&translatedLanguage[]=en&order[chapter]=desc
//      &limit=100&offset=N&contentRating[]=… — returns { data: [{ id,
//      attributes.chapter }], total }, sorted by chapter number.
//   2. Reader URL: https://mangadex.org/chapter/{chapterId} (200, confirmed).
//
// Known limitation (NOT a bug): MangaDex removes officially-licensed English
// chapters, so many popular series (One Piece, Solo Leveling, …) have ZERO en
// chapters here and return "not found" — comick.dev is the better source for
// those. We page DESCENDING and keep the candidate closest to (but greater
// than) afterChapter, mirroring comickChapters.ts, so a reader near the latest
// chapter is found within a few pages regardless of catalog depth.

import type { Env } from "../env";
import { searchMangaDexMatch, MANGADEX_CONTENT_RATING, MANGADEX_UA } from "./mangadex";
import { acquireMangaDexSlot } from "../durable-objects/RateLimiter";
import type { NextChapterResult } from "./comickChapters";

const CHAPTERS_PAGE_LIMIT = 100;
const MAX_CHAPTER_PAGES = 5;
const READER_LANG = "en";

interface MangaDexChapterEntry {
  id?: string;
  attributes?: { chapter?: string | null };
}

interface MangaDexFeedResponse {
  data?: MangaDexChapterEntry[];
}

async function fetchChapterPage(
  mangaId: string,
  offset: number,
): Promise<MangaDexChapterEntry[] | null> {
  const url =
    `https://api.mangadex.org/chapter?manga=${encodeURIComponent(mangaId)}` +
    `&translatedLanguage[]=${READER_LANG}&order[chapter]=desc` +
    `&limit=${CHAPTERS_PAGE_LIMIT}&offset=${offset}${MANGADEX_CONTENT_RATING}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": MANGADEX_UA } });
  } catch (err) {
    console.error(`findNextChapterUrlMangaDex: chapter request error for "${mangaId}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(
      `findNextChapterUrlMangaDex: chapter list failed (${res.status} ${res.statusText}) for "${mangaId}"`,
    );
    return null;
  }
  const body = (await res.json().catch(() => null)) as MangaDexFeedResponse | null;
  return Array.isArray(body?.data) ? body.data : [];
}

/**
 * Finds the chapter right after `afterChapter` for `title` on MangaDex and
 * builds a direct reader URL. Never persists anything — the caller decides
 * whether/where to store the resulting `read_url`.
 */
export async function findNextChapterUrlMangaDex(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireMangaDexSlot(env.RATE_LIMITER);
  const match = await searchMangaDexMatch(title);
  if (!match?.id) {
    return { read_url: null, reason: "Komik tidak ditemukan di MangaDex" };
  }

  let best: MangaDexChapterEntry | null = null;

  for (let page = 0; page < MAX_CHAPTER_PAGES; page++) {
    await acquireMangaDexSlot(env.RATE_LIMITER);
    const chapters = await fetchChapterPage(match.id, page * CHAPTERS_PAGE_LIMIT);
    if (chapters === null) {
      return { read_url: null, reason: "Gagal mengambil daftar chapter dari MangaDex" };
    }
    if (chapters.length === 0) break;

    let crossedBoundary = false;
    for (const chapter of chapters) {
      const chapNum = chapter.attributes?.chapter
        ? Number.parseFloat(chapter.attributes.chapter)
        : NaN;
      if (Number.isNaN(chapNum)) continue;
      if (chapNum > afterChapter) {
        // Descending order: each candidate overwrites the previous, so by the
        // time we cross the boundary `best` holds the closest chapter still
        // greater than afterChapter.
        best = chapter;
      } else {
        crossedBoundary = true;
        break;
      }
    }
    if (crossedBoundary) break;
  }

  if (!best?.id) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di MangaDex" };
  }
  return { read_url: `https://mangadex.org/chapter/${best.id}` };
}
