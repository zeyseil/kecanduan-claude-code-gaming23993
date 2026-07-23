// Kiryuu (v7.kiryuu.to) lookup — Indonesian manga-focused source, added
// alongside Shinigami/Komiku because Shinigami's catalog skews toward
// trending manhwa and is thin on manga (per user feedback).
//
// UNLIKE every other chapter source in this codebase, Kiryuu has NO JSON API
// at all — this is the first source scraped from raw server-rendered HTML.
// That makes it structurally more fragile than comick/MangaDex/Shinigami/
// Komiku: any redesign of the site's markup can silently break parsing here
// (regexes, not a documented schema). Kept because, unlike Komikcast (see
// plan history), Kiryuu is NOT behind a Cloudflare bot-challenge — verified
// live while planning: a plain server fetch (no browser UA needed) gets a
// real 200 HTML page, not a JS challenge.
//
// Search is a two-step WordPress AJAX flow (verified live):
//   1. GET {base}/wp-admin/admin-ajax.php?type=search_form&action=get_nonce
//      -> HTML fragment containing <input name='search_nonce' value='...'>
//   2. POST {base}/wp-admin/admin-ajax.php?nonce={nonce}&action=search
//      body: search_term={title} (form-encoded)
//      -> HTML fragment: repeated `<a href="{base}/manga/{slug}/">...
//         <h3 ...>{title}</h3>...</a>` cards. No cookies/session needed —
//         confirmed live with a fresh nonce per request.

import type { Env } from "../env";
import { pickBestTitleMatch } from "./titleMatch";

const DEFAULT_BASE = "https://v7.kiryuu.to";

export const KIRYUU_UA = "komik-tracker-worker/1.0 (+https://komik-tracker.pages.dev)";

export interface KiryuuMatch {
  title: string;
  /** Full detail-page URL, e.g. https://v7.kiryuu.to/manga/solo-leveling/ */
  url: string;
}

/** Base host resolution — Kiryuu versions its domain (v7, previously other
 * numbers), so it's overridable via env like Shinigami's mirror domains. */
export function kiryuuBase(env: Env): string {
  return (env.KIRYUU_API_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

async function fetchSearchNonce(base: string): Promise<string | null> {
  const url = `${base}/wp-admin/admin-ajax.php?type=search_form&action=get_nonce`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": KIRYUU_UA } });
  } catch (err) {
    console.error(`fetchSearchNonce: request error: ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`fetchSearchNonce: failed (${res.status} ${res.statusText})`);
    return null;
  }
  const html = await res.text();
  const match = html.match(/name=['"]search_nonce['"]\s+value=['"]([a-f0-9]+)['"]/);
  return match ? match[1] : null;
}

/** Parses `<a href="{url}">...<h3 ...>{title}</h3>` cards out of the AJAX
 * search response HTML. Each match is scanned non-greedily up to its own
 * nearest `<h3>` so it can't overrun into the next card's title. */
function parseSearchResults(html: string): KiryuuMatch[] {
  const results: KiryuuMatch[] = [];
  const pattern = /<a href="(https?:\/\/[^"]*\/manga\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].trim();
    const title = match[2].trim();
    if (url && title) results.push({ title, url });
  }
  return results;
}

/**
 * Searches Kiryuu by title and returns the best-matching result (raw, with
 * detail `url` intact) or null if any step fails or no result is a confident
 * title match (shared acceptance rule — lib/titleMatch.ts).
 */
export async function searchKiryuuMatch(title: string, env: Env): Promise<KiryuuMatch | null> {
  const base = kiryuuBase(env);
  const nonce = await fetchSearchNonce(base);
  if (!nonce) {
    console.error(`searchKiryuuMatch: could not obtain search nonce for "${title}"`);
    return null;
  }

  const url = `${base}/wp-admin/admin-ajax.php?nonce=${encodeURIComponent(nonce)}&action=search`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": KIRYUU_UA,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `search_term=${encodeURIComponent(title)}`,
    });
  } catch (err) {
    console.error(`searchKiryuuMatch: search request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`searchKiryuuMatch: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const html = await res.text();
  const entries = parseSearchResults(html);
  if (entries.length === 0) {
    console.error(`searchKiryuuMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, (e) => [e.title]);
  if (!match) {
    console.error(`searchKiryuuMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}
