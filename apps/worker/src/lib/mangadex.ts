// MangaDex lookup: cover art + comic type, behind a title-verification gate.
//
// The gate exists because MangaDex title search is fuzzy and frequently ranks
// an unrelated work first. Verified against the live API while planning this:
// searching "Naruto" returns "Renge to Naruto!" at position 1 and a doujinshi
// ("Uzumaki: Illegitimate", originalLanguage "en") at position 2 — the real
// Naruto is third. The previous implementation took data[0] blindly, so it
// could silently attach the wrong cover to a comic.
//
// Matching also has to consider altTitles, not just `title`: MangaDex stores
// Solo Leveling's canonical title as "Na Honjaman Level-Up" (romanised Korean),
// and the string a user would actually type lives in altTitles.

import type { TypeTag } from "../types/comic";
import { pickBestTitleMatch, STRICT_THRESHOLD, RELAXED_THRESHOLD } from "./titleMatch";

/** Original language -> comic type. Anything else (e.g. "en" on fan works)
 * deliberately maps to null: an unknown language is not a reason to assume manga. */
const LANGUAGE_TO_TYPE_TAG: Record<string, TypeTag> = {
  ja: "manga",
  ko: "manhwa",
  zh: "manhua",
  "zh-hk": "manhua",
};

interface MangaDexCoverArtAttributes {
  fileName: string;
}

interface MangaDexRelationship {
  type: string;
  attributes?: MangaDexCoverArtAttributes;
}

interface MangaDexMangaAttributes {
  title?: Record<string, string>;
  /** Array of single-key maps, e.g. [{ en: "Solo Leveling" }, { ja: "..." }]. */
  altTitles?: Array<Record<string, string>>;
  originalLanguage?: string;
}

interface MangaDexMangaEntry {
  id: string;
  attributes?: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
}

interface MangaDexSearchResponse {
  data: MangaDexMangaEntry[];
}

/** All four content ratings — REQUIRED to see 18+ titles (see fetchMangaDexInfo).
 * Shared with the chapter-feed lookup in mangadexChapters.ts. */
export const MANGADEX_CONTENT_RATING =
  "&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic";

/** Identifying UA — MangaDex rejects/throttles datacenter egress without one.
 * Shared with mangadexChapters.ts so both requests carry the same header. */
export const MANGADEX_UA =
  "komik-tracker-worker/1.0 (personal comic tracker; contact via GitHub repo)";

export interface MangaDexInfo {
  /** null when the matched entry has no cover art relationship. */
  cover_url: string | null;
  /** null when the original language isn't one we map to a comic type. */
  type_tag: TypeTag | null;
}

/** Every title string on an entry: the primary title map plus all altTitles. */
function allTitleStrings(entry: MangaDexMangaEntry): string[] {
  const primary = Object.values(entry.attributes?.title ?? {});
  const alternates = (entry.attributes?.altTitles ?? []).flatMap((alt) => Object.values(alt));
  return [...primary, ...alternates].filter((t) => typeof t === "string" && t.trim() !== "");
}

/**
 * Picks the entry whose best title (primary or alternate) is closest to
 * `queryTitle`, or null when nothing passes the shared acceptance rule in
 * lib/titleMatch.ts (strict 0.85, or relaxed 0.7 + substring — see that file).
 * The same rule verifies AniList results, so "is this the same title?" is
 * answered one way everywhere in the codebase.
 */
export function pickBestMatch(
  entries: MangaDexMangaEntry[],
  queryTitle: string,
): MangaDexMangaEntry | null {
  return pickBestTitleMatch(entries, queryTitle, allTitleStrings);
}

function coverUrlFor(entry: MangaDexMangaEntry): string | null {
  const coverArt = entry.relationships.find((r) => r.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${entry.id}/${fileName}`;
}

/**
 * Searches MangaDex by title and returns the best-matching entry (raw, with
 * `id` intact) or null if the request fails / no result is a confident title
 * match. Shared by fetchMangaDexInfo (cover/type) and mangadexChapters.ts
 * (next-chapter lookup) so there's one search implementation — mirrors the
 * searchComickMatch pattern in comick.ts.
 */
export async function searchMangaDexMatch(title: string): Promise<MangaDexMangaEntry | null> {
  // limit=10 (not 1): the correct result is often not ranked first, so we need
  // candidates to verify against.
  const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&includes[]=cover_art${MANGADEX_CONTENT_RATING}`;

  const res = await fetch(url, { headers: { "User-Agent": MANGADEX_UA } });
  if (!res.ok) {
    console.error(
      `searchMangaDexMatch: search request failed (${res.status} ${res.statusText}) for title "${title}"`,
    );
    return null;
  }

  const body = (await res.json()) as MangaDexSearchResponse;
  const entries = body.data ?? [];
  if (entries.length === 0) {
    console.error(`searchMangaDexMatch: no manga found for title "${title}"`);
    return null;
  }

  const match = pickBestMatch(entries, title);
  if (!match) {
    console.error(
      `searchMangaDexMatch: ${entries.length} kandidat ditemukan untuk "${title}", tapi tidak ada yang lolos ambang kemiripan (${STRICT_THRESHOLD} / ${RELAXED_THRESHOLD}+substring)`,
    );
    return null;
  }
  return match;
}

/**
 * Looks up a comic on MangaDex by title and returns both its cover URL and its
 * comic type. Returns null when no result is a confident title match — callers
 * treat that as "not found" rather than falling back to a guess.
 *
 * contentRating[] is REQUIRED to see 18+ titles: MangaDex defaults to
 * safe/suggestive/erotica and silently drops `pornographic`, so adult manhwa
 * came back "not found" and their covers stayed empty. We request all four
 * ratings — is_adult is a separate user-set field, not derived from this.
 */
export async function fetchMangaDexInfo(title: string): Promise<MangaDexInfo | null> {
  const match = await searchMangaDexMatch(title);
  if (!match) return null;

  const coverUrl = coverUrlFor(match);
  if (!coverUrl) {
    console.error(`fetchMangaDexInfo: manga "${match.id}" has no cover_art relationship`);
  }

  const originalLanguage = match.attributes?.originalLanguage;
  const typeTag = originalLanguage ? (LANGUAGE_TO_TYPE_TAG[originalLanguage] ?? null) : null;
  if (!typeTag) {
    console.error(
      `fetchMangaDexInfo: originalLanguage "${originalLanguage}" untuk "${title}" tidak dipetakan ke jenis komik`,
    );
  }

  return { cover_url: coverUrl, type_tag: typeTag };
}

/** Cover-only wrapper, kept so agent/tools.ts callers stay unchanged. */
export async function fetchMangaDexCover(title: string): Promise<string | null> {
  const info = await fetchMangaDexInfo(title);
  return info?.cover_url ?? null;
}
