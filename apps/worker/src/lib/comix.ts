// Comix API lookup — third external metadata source, after MangaDex/AniList.
// Comix must be self-hosted by the user (a Next.js app); this adapter is a
// no-op that returns null when `env.COMIX_API_URL` is unset, so the pipeline
// never breaks just because the instance isn't deployed yet.
//
// Search response (per repo README): each result has `id`, `title`, `img`
// (already a proxied URL, relative to the Comix instance), `status` (numeric),
// `type` (string, e.g. "manga"/"manhwa"/"manhua"). We deliberately DON'T pass
// `sfw=true` — adult titles must remain visible (is_adult stays a user field).

import type { Env } from "../env";
import type { TypeTag } from "../types/comic";
import type { MangaDexInfo } from "./mangadex";
import { pickBestTitleMatch } from "./titleMatch";

const TYPE_ALIASES: Record<string, TypeTag> = {
  manga: "manga",
  manhwa: "manhwa",
  manhua: "manhua",
};

interface ComixResult {
  id?: string;
  title?: string;
  img?: string;
  type?: string;
}

interface ComixSearchResponse {
  data?: ComixResult[];
  results?: ComixResult[];
}

function typeTagFrom(type: string | undefined): TypeTag | null {
  if (!type) return null;
  return TYPE_ALIASES[type.trim().toLowerCase()] ?? null;
}

/** `img` may be relative to the Comix instance (its built-in image proxy). */
function coverUrlFrom(base: string, img: string | undefined): string | null {
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  return `${base.replace(/\/$/, "")}${img.startsWith("/") ? "" : "/"}${img}`;
}

/**
 * Looks up a comic on a self-hosted Comix instance. Returns null when the
 * source is disabled (no env), the request fails, or no result is a confident
 * title match (same acceptance rule as every other source — lib/titleMatch.ts).
 */
export async function fetchComixInfo(title: string, env: Env): Promise<MangaDexInfo | null> {
  const base = env.COMIX_API_URL?.trim();
  if (!base) return null; // source disabled — silently skipped

  const url = `${base.replace(/\/$/, "")}/api/manga/search?q=${encodeURIComponent(title)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "komik-tracker-worker/1.0 (personal comic tracker)" },
    });
  } catch (err) {
    console.error(`fetchComixInfo: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`fetchComixInfo: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as ComixSearchResponse | null;
  const entries = body?.data ?? body?.results ?? [];
  if (entries.length === 0) {
    console.error(`fetchComixInfo: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(
    entries,
    title,
    (e) => (typeof e.title === "string" && e.title.trim() !== "" ? [e.title] : []),
  );
  if (!match) {
    console.error(`fetchComixInfo: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }

  return {
    cover_url: coverUrlFrom(base, match.img),
    type_tag: typeTagFrom(match.type),
  };
}
