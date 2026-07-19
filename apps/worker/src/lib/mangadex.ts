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
import { titleSimilarity } from "../store/fuzzyMatch";

/** Minimum similarity before a MangaDex result is accepted as "the same comic".
 * Matches BULK_MATCH_THRESHOLD in routes/comics.ts — same question, same bar.
 * Below this we return nothing rather than guess. */
const MATCH_THRESHOLD = 0.85;

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
 * `queryTitle`, or null when nothing clears MATCH_THRESHOLD.
 *
 * Scoring reuses titleSimilarity() from store/fuzzyMatch.ts — the same
 * deterministic token-sort ratio already used to match comics against the
 * user's own library, so "is this the same title?" is answered one way
 * everywhere in the codebase.
 */
export function pickBestMatch(
  entries: MangaDexMangaEntry[],
  queryTitle: string,
): MangaDexMangaEntry | null {
  let best: { entry: MangaDexMangaEntry; score: number } | null = null;

  for (const entry of entries) {
    const titles = allTitleStrings(entry);
    if (titles.length === 0) continue;

    const score = Math.max(...titles.map((t) => titleSimilarity(t, queryTitle)));
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    return null;
  }
  return best.entry;
}

function coverUrlFor(entry: MangaDexMangaEntry): string | null {
  const coverArt = entry.relationships.find((r) => r.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;
  if (!fileName) return null;
  return `https://uploads.mangadex.org/covers/${entry.id}/${fileName}`;
}

/**
 * Looks up a comic on MangaDex by title and returns both its cover URL and its
 * comic type. Returns null when no result is a confident title match — callers
 * treat that as "not found" rather than falling back to a guess.
 */
export async function fetchMangaDexInfo(title: string): Promise<MangaDexInfo | null> {
  // limit=10 (not 1): the correct result is often not ranked first, so we need
  // candidates to verify against.
  const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&includes[]=cover_art`;

  const res = await fetch(url, {
    headers: {
      // MangaDex is known to reject/throttle requests without an identifying UA,
      // especially from datacenter egress IPs (Cloudflare Workers included).
      "User-Agent": "komik-tracker-worker/1.0 (personal comic tracker; contact via GitHub repo)",
    },
  });
  if (!res.ok) {
    console.error(
      `fetchMangaDexInfo: search request failed (${res.status} ${res.statusText}) for title "${title}"`,
    );
    return null;
  }

  const body = (await res.json()) as MangaDexSearchResponse;
  const entries = body.data ?? [];
  if (entries.length === 0) {
    console.error(`fetchMangaDexInfo: no manga found for title "${title}"`);
    return null;
  }

  const match = pickBestMatch(entries, title);
  if (!match) {
    console.error(
      `fetchMangaDexInfo: ${entries.length} kandidat ditemukan untuk "${title}", tapi tidak ada yang lolos ambang kemiripan ${MATCH_THRESHOLD}`,
    );
    return null;
  }

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
