// "Cari link chapter berikutnya" via Kiryuu (Indonesian, manga-focused) — see
// kiryuu.ts for why this source scrapes raw HTML instead of a JSON API.
//
// The detail page embeds the ENTIRE chapter list in one response (189
// chapters observed live for Solo Leveling, no pagination) as repeated
// `href="{base}/manga/{slug}/chapter-{num}/"` links. `{num}` itself may
// contain a decimal point (e.g. "179.6" for a "chapter 179.6" side-story),
// immediately followed by a `.{postId}` suffix that is always plain digits
// (e.g. "chapter-179.6.425255/" = chapter 179.6, WordPress post id 425255).
// We split on the LAST dot to separate postId from the chapter number,
// rather than assuming a fixed number of dots.
//
// IMPORTANT correctness note (found live, not theoretical): the page also
// contains a "start reading" quick-link button (e.g. "Chapter 0") BEFORE the
// real descending chapter list. A naive "stop scanning at the first entry
// <= afterChapter" algorithm (used by comick/Shinigami/Komiku, which get a
// clean single-purpose list from a real API) would hit that stray low
// chapter number first and stop too early, missing the real list further
// down the page. So instead of scanning-and-stopping, we scan the WHOLE
// parsed list and keep the smallest chapter number that is still greater
// than afterChapter (an argmin) — correct regardless of ordering noise.

import type { Env } from "../env";
import type { NextChapterResult } from "./comickChapters";
import { searchKiryuuMatch, KIRYUU_UA } from "./kiryuu";
import { acquireKiryuuSlot } from "../durable-objects/RateLimiter";

interface ParsedChapterLink {
  chapterNumber: number;
  href: string;
}

/** Extracts every `/manga/{slug}/chapter-{num}.{postId}/` link from a detail
 * page's raw HTML, splitting each numeric run on its LAST dot (postId is
 * always plain digits; the chapter number itself may contain one dot). */
function parseChapterLinks(html: string): ParsedChapterLink[] {
  const links: ParsedChapterLink[] = [];
  const pattern = /href="([^"]*\/manga\/[a-z0-9-]+\/chapter-([\d.]+)\/?)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1].trim();
    const numericRun = match[2];
    const parts = numericRun.split(".");
    if (parts.length < 2) continue; // need at least {chapterNum}.{postId}
    const postId = parts[parts.length - 1];
    if (!/^\d+$/.test(postId)) continue;
    const chapterNumberStr = parts.slice(0, -1).join(".");
    const chapterNumber = Number(chapterNumberStr);
    if (Number.isNaN(chapterNumber)) continue;
    links.push({ chapterNumber, href });
  }
  return links;
}

/**
 * Finds the chapter right after `afterChapter` for `title` on Kiryuu and
 * returns its original v7.kiryuu.to URL. Never persists anything itself —
 * callers decide whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrlKiryuu(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireKiryuuSlot(env.RATE_LIMITER);
  const match = await searchKiryuuMatch(title, env);
  if (!match) {
    return { read_url: null, reason: "Komik tidak ditemukan di Kiryuu" };
  }

  await acquireKiryuuSlot(env.RATE_LIMITER);
  let res: Response;
  try {
    res = await fetch(match.url, { headers: { "User-Agent": KIRYUU_UA } });
  } catch (err) {
    console.error(`findNextChapterUrlKiryuu: detail request error for "${match.url}": ${String(err)}`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Kiryuu" };
  }
  if (!res.ok) {
    console.error(`findNextChapterUrlKiryuu: detail failed (${res.status} ${res.statusText}) for "${match.url}"`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Kiryuu" };
  }

  const html = await res.text();
  const links = parseChapterLinks(html);

  // Argmin: the smallest chapter number that is still greater than
  // afterChapter — safe against the stray "quick start" link noted above.
  let best: ParsedChapterLink | null = null;
  for (const link of links) {
    if (link.chapterNumber <= afterChapter) continue;
    if (!best || link.chapterNumber < best.chapterNumber) {
      best = link;
    }
  }

  if (!best) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di Kiryuu" };
  }
  return { read_url: best.href };
}
