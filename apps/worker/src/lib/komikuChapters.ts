// "Cari link chapter berikutnya" via Komiku (Indonesian) — reuses the same
// search + env-gate as komiku.ts (the cover/type source), extended with a
// detail-page chapter list. Verified live against the project's own Komiku
// instance while planning:
//   GET {base}/detail-komik/{slug}
//   -> { ..., chapters: [{ title, originalLink, apiLink, chapterNumber, date }] }
// Newest first (confirmed live: 180,179,178…), `chapterNumber` is already a
// clean number (no per-scanlation-group duplicates like comick), and
// `originalLink` is a real komiku.org URL — no reader-URL guessing needed,
// unlike Shinigami. The whole chapter list comes back in one response (no
// paging observed for a 180-chapter series), so there's no MAX_CHAPTER_PAGES
// here — if a longer-running series turns out to paginate, that'll surface as
// a "not found" result, not a crash.

import type { Env } from "../env";
import type { NextChapterResult } from "./comickChapters";
import { searchKomikuMatch, komikuBase, slugOf } from "./komiku";
import { acquireKomikuSlot } from "../durable-objects/RateLimiter";

interface KomikuChapter {
  chapterNumber?: number | string;
  originalLink?: string;
}

interface KomikuDetailResponse {
  chapters?: KomikuChapter[];
}

/**
 * Finds the chapter right after `afterChapter` for `title` on Komiku and
 * returns its original komiku.org URL. Never persists anything itself —
 * callers decide whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrlKomiku(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  const base = komikuBase(env);
  if (!base) {
    return { read_url: null, reason: "Komiku belum dikonfigurasi (perlu KOMIKU_API_URL)" };
  }

  await acquireKomikuSlot(env.RATE_LIMITER);
  const match = await searchKomikuMatch(title, env);
  const slug = match ? slugOf(match) : undefined;
  if (!slug) {
    return { read_url: null, reason: "Komik tidak ditemukan di Komiku" };
  }

  await acquireKomikuSlot(env.RATE_LIMITER);
  const url = `${base}/detail-komik/${encodeURIComponent(slug)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "komik-tracker-worker/1.0 (personal comic tracker)" },
    });
  } catch (err) {
    console.error(`findNextChapterUrlKomiku: detail request error for "${slug}": ${String(err)}`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Komiku" };
  }
  if (!res.ok) {
    console.error(`findNextChapterUrlKomiku: detail failed (${res.status} ${res.statusText}) for "${slug}"`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Komiku" };
  }

  const body = (await res.json().catch(() => null)) as KomikuDetailResponse | null;
  const chapters = Array.isArray(body?.chapters) ? body.chapters : [];

  let best: KomikuChapter | null = null;
  for (const chapter of chapters) {
    const chapNum = Number(chapter.chapterNumber);
    if (Number.isNaN(chapNum)) continue;
    if (chapNum > afterChapter) {
      // Descending order: each candidate seen overwrites the previous one, so
      // by the time we stop scanning `best` holds the closest chapter still
      // greater than afterChapter.
      best = chapter;
    } else {
      break;
    }
  }

  if (!best) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komiku" };
  }
  if (!best.originalLink) {
    return { read_url: null, reason: "Chapter berikutnya ditemukan tapi datanya tidak lengkap" };
  }
  return { read_url: best.originalLink };
}
