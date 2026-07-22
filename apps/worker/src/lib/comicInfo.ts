// Single entry point for external comic metadata. Sources are tried in a fixed
// priority order and their results MERGED: the first source to provide a cover
// wins for the cover, the first to provide a type wins for the type. As soon as
// both are known we stop (no wasted requests / subrequest budget).
//
// Order (user decision): MangaDex → comick → AniList → Komiku. comick is a
// public API called directly (like mangadex/anilist), always enabled. Komiku is
// third-party/self-hosted and skips itself (returns null) when its env URL is
// unset, so the chain degrades gracefully.
//
// Rate-limit slots are acquired HERE, per source actually called (and only when
// that source is enabled) — callers must not acquire their own slots on top.

import type { Env } from "../env";
import type { MangaDexInfo } from "./mangadex";
import { fetchMangaDexInfo } from "./mangadex";
import { fetchAniListInfo } from "./anilist";
import { fetchComickInfo } from "./comick";
import { fetchKomikuInfo } from "./komiku";
import {
  acquireAniListSlot,
  acquireComickSlot,
  acquireKomikuSlot,
  acquireMangaDexSlot,
} from "../durable-objects/RateLimiter";

export type ComicInfoSource = string;

export interface ComicInfo extends MangaDexInfo {
  /** Which source(s) contributed, e.g. "mangadex", "mangadex+anilist", "komiku". */
  source: ComicInfoSource;
}

interface Source {
  name: string;
  /** false = disabled (e.g. no env URL) → skipped without acquiring a slot. */
  enabled: boolean;
  acquire: () => Promise<void>;
  fetch: () => Promise<MangaDexInfo | null>;
}

export async function fetchComicInfo(title: string, env: Env): Promise<ComicInfo | null> {
  const sources: Source[] = [
    {
      name: "mangadex",
      enabled: true,
      acquire: () => acquireMangaDexSlot(env.RATE_LIMITER),
      fetch: () => fetchMangaDexInfo(title),
    },
    {
      name: "comick",
      enabled: true,
      acquire: () => acquireComickSlot(env.RATE_LIMITER),
      fetch: () => fetchComickInfo(title, env),
    },
    {
      name: "anilist",
      enabled: true,
      acquire: () => acquireAniListSlot(env.RATE_LIMITER),
      fetch: () => fetchAniListInfo(title),
    },
    {
      name: "komiku",
      enabled: !!env.KOMIKU_API_URL?.trim(),
      acquire: () => acquireKomikuSlot(env.RATE_LIMITER),
      fetch: () => fetchKomikuInfo(title, env),
    },
  ];

  let coverUrl: string | null = null;
  let typeTag: MangaDexInfo["type_tag"] = null;
  const contributors: string[] = [];

  for (const source of sources) {
    if (coverUrl && typeTag) break; // already complete — stop early
    if (!source.enabled) continue;

    await source.acquire();
    const info = await source.fetch();
    if (!info) continue;

    let contributed = false;
    if (!coverUrl && info.cover_url) {
      coverUrl = info.cover_url;
      contributed = true;
    }
    if (!typeTag && info.type_tag) {
      typeTag = info.type_tag;
      contributed = true;
    }
    if (contributed) contributors.push(source.name);
  }

  if (!coverUrl && !typeTag) return null;
  return { cover_url: coverUrl, type_tag: typeTag, source: contributors.join("+") };
}
