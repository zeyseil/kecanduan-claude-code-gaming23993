// comick.io lookup — built-in metadata source, tried right after MangaDex and
// before AniList (user decision: comick's broad coverage + a clean `country`
// field make it a strong second source). Same shape as fetchMangaDexInfo so
// callers treat every source interchangeably (lib/comicInfo.ts).
//
// Unlike comix/komiku (user self-hosted, env-gated), comick is a PUBLIC API we
// call DIRECTLY — no hosting, exactly like mangadex/anilist. Verified live: the
// Worker can reach it just as it already reaches Cloudflare-fronted
// api.mangadex.org.
//
// Two deliberate choices, both verified against the live API while planning:
//   1. Base host is `api.comick.dev`. Note `comick.dev` (no `api.`) is the
//      *website* and returns an HTML 404 for API paths; `api.comick.fun` /
//      `api.comick.io` have moved/redirect. Overridable via env.COMICK_API_URL
//      as an escape hatch since comick has changed domains before (fun→io→dev).
//   2. We send a BROWSER User-Agent (Mozilla/5.0 … Chrome). comick's Cloudflare
//      returns 403 to non-browser UAs (confirmed live); a browser UA gets 200
//      JSON. This is the OPPOSITE of mangadex.ts, which wants an identifying UA.
//      Fragility note: if comick ever enforces TLS/JA3 fingerprinting, even a
//      browser UA from the Worker could 403 — then point COMICK_API_URL at a
//      proxy, or rely on the mangadex/anilist/komiku fallback that still runs.
//
// Search response is a TOP-LEVEL array (not {data}). Fields we use per result:
//   title (string), md_titles[].title (alt titles, many langs incl. EN),
//   country ("jp"/"kr"/"cn"/… lowercase → type), md_covers[0].b2key (cover).
// `media_type` is generically "manga" even for a manhwa, so `country` is the
// only reliable type signal. `content_rating` is NOT read — is_adult stays a
// user-set field (SPEC.md §8), and comick returns adult titles by default anyway.
// `hid` is comick's stable id for future comic/chapter (reading) endpoints —
// captured here as a marker; unused for cover-only lookups today.

import type { Env } from "../env";
import type { TypeTag } from "../types/comic";
import type { MangaDexInfo } from "./mangadex";
import { pickBestTitleMatch } from "./titleMatch";

const DEFAULT_BASE = "https://api.comick.dev";

// comick's Cloudflare rejects non-browser User-Agents — a realistic browser UA
// is required (verified live). See module comment.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const COUNTRY_TO_TYPE_TAG: Record<string, TypeTag> = {
  jp: "manga",
  kr: "manhwa",
  cn: "manhua",
  hk: "manhua",
  tw: "manhua",
};

interface ComickCover {
  b2key?: string;
}

interface ComickTitle {
  title?: string;
}

export interface ComickResult {
  /** comick's stable id — used by comickChapters.ts to look up this comic's chapter list. */
  hid?: string;
  /** comic's URL slug, e.g. "00-solo-leveling" — needed to build a comick.dev reader URL. */
  slug?: string;
  title?: string;
  country?: string;
  md_titles?: ComickTitle[];
  md_covers?: ComickCover[];
}

/** Base host resolution shared with comickChapters.ts — comick has changed domains
 * before (fun→io→dev), so both call sites honor the same env override. */
export function comickBase(env: Env): string {
  return (env.COMICK_API_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

/** comick's browser-only-UA requirement (see module comment) — exported so
 * comickChapters.ts's chapter-list fetch uses the identical header. */
export { BROWSER_UA };

/**
 * Searches comick.io by title and returns the best-matching result (raw, with
 * `hid`/`slug` intact) or null if no request succeeds / no result is a
 * confident title match. Shared by fetchComickInfo (cover/type lookup) and
 * comickChapters.ts (next-chapter lookup) so there's one search implementation.
 */
export async function searchComickMatch(title: string, env: Env): Promise<ComickResult | null> {
  const base = comickBase(env);
  const url = `${base}/v1.0/search/?q=${encodeURIComponent(title)}&limit=10&page=1`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  } catch (err) {
    console.error(`searchComickMatch: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`searchComickMatch: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as unknown;
  const entries: ComickResult[] = Array.isArray(body) ? (body as ComickResult[]) : [];
  if (entries.length === 0) {
    console.error(`searchComickMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, titlesOf);
  if (!match) {
    console.error(`searchComickMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Primary title plus every alt title in md_titles (many languages incl. EN). */
function titlesOf(entry: ComickResult): string[] {
  const titles = [str(entry.title), ...(entry.md_titles ?? []).map((t) => str(t?.title))];
  return titles.filter((t): t is string => t !== undefined);
}

function coverUrlFrom(entry: ComickResult): string | null {
  const b2key = str(entry.md_covers?.[0]?.b2key);
  return b2key ? `https://meo.comick.pictures/${b2key}` : null;
}

function typeTagFrom(country: string | undefined): TypeTag | null {
  if (!country) return null;
  return COUNTRY_TO_TYPE_TAG[country.trim().toLowerCase()] ?? null;
}

/**
 * Looks up a comic on comick.io by title. Returns null when the request fails or
 * no result is a confident title match (shared acceptance rule — lib/titleMatch.ts).
 */
export async function fetchComickInfo(title: string, env: Env): Promise<MangaDexInfo | null> {
  const match = await searchComickMatch(title, env);
  if (!match) return null;
  return { cover_url: coverUrlFrom(match), type_tag: typeTagFrom(match.country) };
}
