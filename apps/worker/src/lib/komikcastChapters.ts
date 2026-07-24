// "Cari link chapter berikutnya" via Komikcast's backend API (be.komikcast.cc)
// — see komikcast.ts for the full history of how this API was discovered
// (previously scraped via Cloudflare Browser Rendering; the SPA's own JSON
// API turned out to be unprotected and far simpler/faster to call directly).
//
// Verified live (curl): GET {api}/series/{slug}/chapters returns
//   { data: [{ id, data: { slug, title, index, seriesId, ... } }] }
// sorted descending by `index` for "Solo Leveling" (179.2, 179.1, 179, 178,
// ... 1, 0) — but every sampled chapter had `data.slug: null`, so we can't
// rely on a per-chapter slug. We use argmin (not descending-stop) anyway,
// consistent with kiryuuChapters.ts: order was only verified for ONE series,
// not guaranteed clean for all of them.
//
// READER URL — the *route pattern* `/series/:seriesSlug/chapter/:chapterSlug`
// was found live in the site's own JS bundle (grep on the built asset, not
// guessed), but since the API's chapter `slug` is always null, `:chapterSlug`
// here is a BEST-EFFORT fallback of the numeric chapter index as a string
// (e.g. "179", "179.1") — a common convention in these SPA readers, but NOT
// independently confirmed to render the right chapter (curl can't execute the
// client-side route to verify — every path 200s on an SPA regardless of
// validity). Documented as a known gap; verify by opening a resulting URL in
// a real browser (see CLAUDE.md verification steps).

import type { Env } from "../env";
import type { NextChapterResult } from "./comickChapters";
import { komikcastApiBase, komikcastReaderBase, searchKomikcastMatch } from "./komikcast";
import { acquireKomikcastSlot } from "../durable-objects/RateLimiter";

interface KomikcastChapterEntry {
  data?: {
    index?: number;
  };
}

interface KomikcastChaptersResponse {
  data?: KomikcastChapterEntry[];
}

/**
 * Finds the chapter right after `afterChapter` for `title` on Komikcast and
 * returns a best-effort reader URL to it. Never persists anything itself —
 * callers decide whether/where to store the resulting `read_url` string.
 */
export async function findNextChapterUrlKomikcast(
  title: string,
  afterChapter: number,
  env: Env,
): Promise<NextChapterResult> {
  await acquireKomikcastSlot(env.RATE_LIMITER);
  const match = await searchKomikcastMatch(title, env);
  if (!match) {
    return { read_url: null, reason: "Komik tidak ditemukan di Komikcast" };
  }

  await acquireKomikcastSlot(env.RATE_LIMITER);
  const apiBase = komikcastApiBase(env);
  const chaptersUrl = `${apiBase}/series/${encodeURIComponent(match.slug)}/chapters`;

  let res: Response;
  try {
    res = await fetch(chaptersUrl);
  } catch (err) {
    console.error(`findNextChapterUrlKomikcast: request error for "${chaptersUrl}": ${String(err)}`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Komikcast" };
  }
  if (!res.ok) {
    console.error(`findNextChapterUrlKomikcast: failed (${res.status} ${res.statusText}) for "${chaptersUrl}"`);
    return { read_url: null, reason: "Gagal mengambil daftar chapter dari Komikcast" };
  }

  const body = (await res.json().catch(() => null)) as KomikcastChaptersResponse | null;
  const entries = Array.isArray(body?.data) ? body.data : [];

  // Argmin: the smallest chapter index that is still greater than
  // afterChapter — safe regardless of whether the API's sort order holds for
  // every series (only verified live for one).
  let best: number | null = null;
  for (const entry of entries) {
    const index = entry.data?.index;
    if (typeof index !== "number" || !Number.isFinite(index)) continue;
    if (index <= afterChapter) continue;
    if (best === null || index < best) {
      best = index;
    }
  }

  if (best === null) {
    return { read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komikcast" };
  }

  const readerBase = komikcastReaderBase(env);
  const read_url = `${readerBase}/series/${match.slug}/chapter/${best}`;
  return { read_url };
}
