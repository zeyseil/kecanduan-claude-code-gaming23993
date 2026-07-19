// Single entry point for external comic metadata: MangaDex first, AniList as
// fallback (user decision, dogfooding slice). Also merges: when MangaDex finds
// the comic but can't answer everything (e.g. originalLanguage "en" on a
// webtoon → no type_tag, the "Unordinary" case from the logs), AniList fills
// the gaps instead of being skipped.
//
// Rate-limit slots are acquired HERE, per source actually called — callers
// must not acquire their own slots on top of this.

import type { Env } from "../env";
import type { MangaDexInfo } from "./mangadex";
import { fetchMangaDexInfo } from "./mangadex";
import { fetchAniListInfo } from "./anilist";
import { acquireAniListSlot, acquireMangaDexSlot } from "../durable-objects/RateLimiter";

export type ComicInfoSource = "mangadex" | "anilist" | "mangadex+anilist";

export interface ComicInfo extends MangaDexInfo {
  source: ComicInfoSource;
}

export async function fetchComicInfo(title: string, env: Env): Promise<ComicInfo | null> {
  await acquireMangaDexSlot(env.RATE_LIMITER);
  const mangadex = await fetchMangaDexInfo(title);
  if (mangadex && mangadex.cover_url && mangadex.type_tag) {
    return { ...mangadex, source: "mangadex" };
  }

  await acquireAniListSlot(env.RATE_LIMITER);
  const anilist = await fetchAniListInfo(title);

  if (!mangadex) {
    return anilist ? { ...anilist, source: "anilist" } : null;
  }
  if (!anilist) {
    return { ...mangadex, source: "mangadex" };
  }
  // MangaDex found the comic but with gaps — prefer its values, fill nulls
  // from AniList.
  return {
    cover_url: mangadex.cover_url ?? anilist.cover_url,
    type_tag: mangadex.type_tag ?? anilist.type_tag,
    source: "mangadex+anilist",
  };
}
