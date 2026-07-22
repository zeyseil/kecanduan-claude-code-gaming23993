// "Cari link chapter berikutnya" — auto-fills read_url with a direct link to
// the chapter right after a comic's current latest_chapter, using comick.dev.
// Two endpoints verified LIVE while planning this feature (WebFetch can't reach
// comick.dev without a browser UA, so this was checked with curl):
//   1. GET {base}/comic/{hid}/chapters?lang=en&page=N&limit=200 — returns
//      { chapters: [{ hid, chap, lang, ... }], total }, always sorted NEWEST
//      first regardless of an `order=asc` param (tried live — ignored).
//   2. Reader URL: https://comick.io/comic/{slug}/{chapterHid}-chapter-{chap}-{lang}
//      301-redirects (confirmed live) to https://comick.dev/comic/... which
//      200s — so we build the comick.dev URL directly to skip the redirect hop.
//
// Popular series interleave many scanlation groups per chapter number (e.g.
// Solo Leveling: 817 total "chapters" for ~200 real chapter numbers), so a
// single page of even 200 entries may not reach far back in a long-running
// series. We only need chapters NEAR afterChapter (the user's current
// progress), so we page forward (still descending) until we cross below
// afterChapter, bounded by MAX_CHAPTER_PAGES to stay within Workers'
// subrequest budget — deep back-catalog lookups may not find a match; that's
// a known, documented limitation, not a bug.

import type { Env } from "../env";
import { comickBase, BROWSER_UA, searchComickMatch, type ComickResult } from "./comick";
import { acquireComickSlot } from "../durable-objects/RateLimiter";

const CHAPTERS_PAGE_LIMIT = 200;
const MAX_CHAPTER_PAGES = 5;
const READER_LANG = "en";

interface ComickChapter {
  hid?: string;
  chap?: string | null;
  lang?: string;
}

interface ComickChaptersResponse {
  chapters?: ComickChapter[];
}

export type NextChapterResult = { read_url: string } | { read_url: null; reason: string };

async function fetchChapterPage(
  base: string,
  hid: string,
  page: number,
): Promise<ComickChapter[] | null> {
  const url = `${base}/comic/${encodeURIComponent(hid)}/chapters?lang=${READER_LANG}&page=${page}&limit=${CHAPTERS_PAGE_LIMIT}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  } catch (err) {
    console.error(`findNextChapterUrl: chapter-list request error for hid "${hid}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`findNextChapterUrl: chapter-list failed (${res.status} ${res.statusText}) for hid "${hid}"`);
    return null;
  }
  const body = (await res.json().catch(() => null)) as ComickChaptersResponse | null;
  return Array.isArray(body?.chapters) ? body.chapters : [];
}

function readerUrl(match: ComickResult, chapter: ComickChapter): string | null {
  if (!match.slug || !chapter.hid || !chapter.chap) return null;
  return `https://comick.dev/comic/${match.slug}/${chapter.hid}-chapter-${chapter.chap}-${READER_LANG}`;
}

/**
 * Finds the chapter right after `afterChapter` for `title` on comick.dev and
 * builds a direct reader URL to it. Never persists anything itself — callers
 * decide whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrl(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireComickSlot(env.RATE_LIMITER);
  const match = await searchComickMatch(title, env);
  if (!match?.hid) {
    return { read_url: null, reason: "Komik tidak ditemukan di comick.dev" };
  }

  const base = comickBase(env);
  let best: ComickChapter | null = null;

  for (let page = 1; page <= MAX_CHAPTER_PAGES; page++) {
    await acquireComickSlot(env.RATE_LIMITER);
    const chapters = await fetchChapterPage(base, match.hid, page);
    if (chapters === null) {
      return { read_url: null, reason: "Gagal mengambil daftar chapter dari comick.dev" };
    }
    if (chapters.length === 0) break;

    let crossedBoundary = false;
    for (const chapter of chapters) {
      const chapNum = chapter.chap ? Number.parseFloat(chapter.chap) : NaN;
      if (Number.isNaN(chapNum)) continue;
      if (chapNum > afterChapter) {
        // Descending order: each candidate seen overwrites the previous one,
        // so by the time we cross the boundary `best` holds the closest chap
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
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di comick.dev" };
  }

  const url = readerUrl(match, best);
  if (!url) {
    return { read_url: null, reason: "Chapter berikutnya ditemukan tapi datanya tidak lengkap" };
  }
  return { read_url: url };
}
