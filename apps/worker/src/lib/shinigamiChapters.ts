// "Cari link chapter berikutnya" via Shinigami Scans (Indonesian). Mirrors the
// comickChapters.ts pattern: search -> page the chapter list (descending) until
// crossing below afterChapter -> build a direct reader URL to the closest
// chapter still greater than afterChapter. Never persists anything.
//
// Chapter-list endpoint (verified live while planning):
//   GET {base}/v1/chapter/{manga_id}/list?page=N&page_size=100&sort_by=chapter_number&sort_order=desc
//   -> { data: [{ chapter_id, chapter_number, manga_id, ... }], ... }
// Returns NEWEST first (confirmed: 179,178,177…). Unlike comick, Shinigami is a
// single source, so chapter_number is clean (no per-scanlation-group dupes).
//
// Reader URL: {readerBase}/chapter/{chapter_id}. The backend only gives a
// chapter_id UUID (no slug/URL), and the frontend blocks bots, so this exact
// path is a documented assumption — if it 404s, adjust readerUrl() or set
// SHINIGAMI_READER_URL. See the plan's manual-verification note.

import type { Env } from "../env";
import type { NextChapterResult } from "./comickChapters";
import { searchShinigamiMatch, shinigamiBase, shinigamiReaderBase, SHINIGAMI_UA } from "./shinigami";
import { acquireShinigamiSlot } from "../durable-objects/RateLimiter";

const CHAPTERS_PAGE_LIMIT = 100;
const MAX_CHAPTER_PAGES = 5;

interface ShinigamiChapter {
  chapter_id?: string;
  chapter_number?: number | string;
}

interface ShinigamiChaptersResponse {
  data?: ShinigamiChapter[];
}

async function fetchChapterPage(
  base: string,
  mangaId: string,
  page: number,
): Promise<ShinigamiChapter[] | null> {
  const url = `${base}/v1/chapter/${encodeURIComponent(mangaId)}/list?page=${page}&page_size=${CHAPTERS_PAGE_LIMIT}&sort_by=chapter_number&sort_order=desc`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": SHINIGAMI_UA } });
  } catch (err) {
    console.error(`findNextChapterUrlShinigami: chapter-list request error for manga "${mangaId}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(
      `findNextChapterUrlShinigami: chapter-list failed (${res.status} ${res.statusText}) for manga "${mangaId}"`,
    );
    return null;
  }
  const body = (await res.json().catch(() => null)) as ShinigamiChaptersResponse | null;
  return Array.isArray(body?.data) ? body.data : [];
}

function readerUrl(env: Env, chapter: ShinigamiChapter): string | null {
  if (!chapter.chapter_id) return null;
  return `${shinigamiReaderBase(env)}/chapter/${chapter.chapter_id}`;
}

/**
 * Finds the chapter right after `afterChapter` for `title` on Shinigami and
 * builds a direct reader URL to it. Never persists anything itself — callers
 * decide whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrlShinigami(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireShinigamiSlot(env.RATE_LIMITER);
  const match = await searchShinigamiMatch(title, env);
  if (!match?.manga_id) {
    return { read_url: null, reason: "Komik tidak ditemukan di Shinigami" };
  }

  const base = shinigamiBase(env);
  let best: ShinigamiChapter | null = null;

  for (let page = 1; page <= MAX_CHAPTER_PAGES; page++) {
    await acquireShinigamiSlot(env.RATE_LIMITER);
    const chapters = await fetchChapterPage(base, match.manga_id, page);
    if (chapters === null) {
      return { read_url: null, reason: "Gagal mengambil daftar chapter dari Shinigami" };
    }
    if (chapters.length === 0) break;

    let crossedBoundary = false;
    for (const chapter of chapters) {
      const chapNum = Number(chapter.chapter_number);
      if (Number.isNaN(chapNum)) continue;
      if (chapNum > afterChapter) {
        // Descending order: each candidate seen overwrites the previous one, so
        // by the time we cross the boundary `best` holds the closest chapter
        // still greater than afterChapter.
        best = chapter;
      } else {
        crossedBoundary = true;
        break;
      }
    }
    if (crossedBoundary) break;
  }

  if (!best) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di Shinigami" };
  }

  const url = readerUrl(env, best);
  if (!url) {
    return { read_url: null, reason: "Chapter berikutnya ditemukan tapi datanya tidak lengkap" };
  }
  return { read_url: url };
}
