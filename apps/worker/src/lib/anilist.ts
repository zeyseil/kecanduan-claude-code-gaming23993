// AniList lookup — fallback metadata source after MangaDex (user decision,
// dogfooding slice: many titles simply aren't on MangaDex, or their original
// language isn't mapped there). Same shape as fetchMangaDexInfo so callers can
// treat both sources interchangeably.
//
// AniList is a good second source for this app specifically because
// `countryOfOrigin` maps 1:1 to our type_tag (JP→manga, KR→manhwa, CN/TW→manhua)
// and cover images are served from a stable CDN without hotlink protection.
// No API key required.

import type { TypeTag } from "../types/comic";
import type { MangaDexInfo } from "./mangadex";
import { pickBestTitleMatch } from "./titleMatch";

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

const COUNTRY_TO_TYPE_TAG: Record<string, TypeTag> = {
  JP: "manga",
  KR: "manhwa",
  CN: "manhua",
  TW: "manhua",
};

// Only the fields we use. `type: MANGA` on AniList covers manga/manhwa/manhua.
const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: MANGA) {
      title { romaji english native }
      synonyms
      countryOfOrigin
      coverImage { extraLarge large }
    }
  }
}`;

interface AniListMedia {
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: Array<string | null>;
  countryOfOrigin?: string | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface AniListResponse {
  data?: { Page?: { media?: AniListMedia[] } };
}

/** Every title string on a media entry: romaji/english/native plus synonyms. */
function allTitleStrings(media: AniListMedia): string[] {
  const titles = [
    media.title?.romaji,
    media.title?.english,
    media.title?.native,
    ...(media.synonyms ?? []),
  ];
  return titles.filter((t): t is string => typeof t === "string" && t.trim() !== "");
}

/**
 * Looks up a comic on AniList by title. Returns null when no result is a
 * confident title match (same acceptance rule as MangaDex — lib/titleMatch.ts).
 */
export async function fetchAniListInfo(title: string): Promise<MangaDexInfo | null> {
  const res = await fetch(ANILIST_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: title } }),
  });
  if (!res.ok) {
    console.error(
      `fetchAniListInfo: search request failed (${res.status} ${res.statusText}) for title "${title}"`,
    );
    return null;
  }

  const body = (await res.json()) as AniListResponse;
  const entries = body.data?.Page?.media ?? [];
  if (entries.length === 0) {
    console.error(`fetchAniListInfo: no media found for title "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, allTitleStrings);
  if (!match) {
    console.error(
      `fetchAniListInfo: ${entries.length} kandidat ditemukan untuk "${title}", tapi tidak ada yang lolos ambang kemiripan`,
    );
    return null;
  }

  const coverUrl = match.coverImage?.extraLarge ?? match.coverImage?.large ?? null;
  if (!coverUrl) {
    console.error(`fetchAniListInfo: match untuk "${title}" tidak punya coverImage`);
  }

  const country = match.countryOfOrigin;
  const typeTag = country ? (COUNTRY_TO_TYPE_TAG[country] ?? null) : null;
  if (!typeTag) {
    console.error(
      `fetchAniListInfo: countryOfOrigin "${country}" untuk "${title}" tidak dipetakan ke jenis komik`,
    );
  }

  return { cover_url: coverUrl, type_tag: typeTag };
}
