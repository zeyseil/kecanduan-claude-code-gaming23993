// Komikcast (Indonesian, general-catalog manga/manhwa/manhua site) lookup.
//
// HISTORY (see plan/CLAUDE.md for full narrative): this originally went
// through Cloudflare Browser Rendering, because v3.komikcast.fit itself sits
// behind a Cloudflare bot-challenge that a plain fetch() can't solve, and the
// site turned out to be a client-rendered SPA (its `?s=` query string just
// loads the homepage — NOT a WordPress ?s= search as first assumed). While
// debugging that live via Browser Rendering's network-response interception,
// the SPA's own backend API was discovered: `https://be.komikcast.cc` — a
// clean, UNPROTECTED JSON REST API (confirmed live via curl, no bot-challenge,
// no browser needed) that the frontend itself calls for all its data. Using
// it directly is strictly better than scraping the SPA: faster, no Cloudflare
// Browser Rendering quota (10 browser-minutes/day account-wide) consumed, and
// no bot-detection risk at all.
//
// Verified live (curl):
//   GET https://be.komikcast.cc/series?title={query}
//     -> { data: [{ id, data: { title, nativeTitle, slug, format, status,
//          totalChapters, ... } }], meta: { total, page, lastPage } }
//     "title" is genuinely a substring/fuzzy search param — e.g. "Solo
//     Leveling" returns "Solo Leveling: Ragnarok", "Solo Leveling: Side
//     Story", AND the base "Solo Leveling" (slug "solo-leveling") — the
//     shared title-match gate (titleMatch.ts) picks the right one.
//
// The reader URL pattern (`/series/:seriesSlug/chapter/:chapterSlug`) was
// found in the site's own JS bundle (grepped live, not guessed) — see
// komikcastChapters.ts for the caveat on `:chapterSlug` (the API's own
// `slug` field is always null for chapters, so this is a best-effort
// numeric-index fallback, NOT independently confirmed to render a chapter).

import type { Env } from "../env";
import { pickBestTitleMatch } from "./titleMatch";

const DEFAULT_API_BASE = "https://be.komikcast.cc";
const DEFAULT_READER_BASE = "https://v3.komikcast.fit";

export interface KomikcastMatch {
  title: string;
  nativeTitle: string;
  /** Series slug, e.g. "solo-leveling" — used to build both the chapters API
   * URL and the reader URL. */
  slug: string;
}

/** Backend API base — overridable in case be.komikcast.cc rotates like the
 * frontend domain has historically done. */
export function komikcastApiBase(env: Env): string {
  return (env.KOMIKCAST_API_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

/** Frontend/reader base — separate from the API host; overridable for the
 * same domain-rotation reason. */
export function komikcastReaderBase(env: Env): string {
  return (env.KOMIKCAST_READER_URL?.trim() || DEFAULT_READER_BASE).replace(/\/$/, "");
}

interface KomikcastSeriesEntry {
  id?: number;
  data?: {
    title?: string;
    nativeTitle?: string;
    slug?: string;
  };
}

interface KomikcastSeriesSearchResponse {
  data?: KomikcastSeriesEntry[];
}

/**
 * Searches Komikcast's backend API by title and returns the best-matching
 * result, or null if the request fails or no candidate passes the shared
 * title-match acceptance rule (lib/titleMatch.ts, same gate used by every
 * other source).
 */
export async function searchKomikcastMatch(title: string, env: Env): Promise<KomikcastMatch | null> {
  const base = komikcastApiBase(env);
  const url = `${base}/series?title=${encodeURIComponent(title)}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`searchKomikcastMatch: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`searchKomikcastMatch: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as KomikcastSeriesSearchResponse | null;
  const rawEntries = Array.isArray(body?.data) ? body.data : [];
  const entries: KomikcastMatch[] = [];
  for (const entry of rawEntries) {
    const slug = entry.data?.slug;
    const entryTitle = entry.data?.title;
    if (!slug || !entryTitle) continue;
    entries.push({ title: entryTitle, nativeTitle: entry.data?.nativeTitle || "", slug });
  }

  if (entries.length === 0) {
    console.error(`searchKomikcastMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, (e) => [e.title, e.nativeTitle].filter(Boolean));
  if (!match) {
    console.error(`searchKomikcastMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}
