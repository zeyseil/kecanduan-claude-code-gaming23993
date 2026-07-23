// Komiku API lookup — fourth external metadata source, last in the fallback
// chain. Good for Indonesian/local titles that aren't on MangaDex/AniList.
//
// Verified live against https://komiku-rest-api.vercel.app/search?q=... (the
// project's own public deployment): a real result looks like
//   { status, message, keyword, url, total,
//     data: [{ title, altTitle, slug, href, thumbnail, type, genre, description }] }
// — confirming `data[]` + `title`/`thumbnail`/`type` as the primary field
// names below. Kept DEFENSIVE regardless (extra field-name fallbacks, never
// throws) since this is an unversioned scraper API that can change shape
// without notice. Gated on `env.KOMIKU_API_URL` (no-op if unset) so a
// wrong/absent instance never breaks the pipeline.
//
// Real quirk observed live: a query with NO actual match doesn't return an
// empty data[] — it returns total:1 with a placeholder entry
// { title: "Manga", slug: "", href: "/detail-komik//", thumbnail: "",
//   source: "generic-parser" } (no `type` field at all). That placeholder
// always has an empty `slug`/`href`, which real results never do, so entries
// without a slug are filtered out before title-matching — otherwise "Manga"
// could theoretically compete as a false candidate.

import type { Env } from "../env";
import type { TypeTag } from "../types/comic";
import type { MangaDexInfo } from "./mangadex";
import { pickBestTitleMatch } from "./titleMatch";

export interface KomikuResult {
  [key: string]: unknown;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Base host resolution — null when the source is disabled (no env). Shared
 * by fetchKomikuInfo (cover/type) and komikuChapters.ts (chapter lookup) so
 * there's one definition of "is Komiku configured". */
export function komikuBase(env: Env): string | null {
  const base = env.KOMIKU_API_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

/** True for a real result. Filters out the "no match" placeholder entry
 * (empty slug/href, no real data) seen live — see module comment. */
export function isRealResult(entry: KomikuResult): boolean {
  return str(entry.slug) !== undefined || str(entry.href) !== undefined;
}

/** The Komiku `slug` field — used by komikuChapters.ts to fetch chapter detail. */
export function slugOf(entry: KomikuResult): string | undefined {
  return str(entry.slug);
}

/** Title strings under any of the field names Komiku scrapers commonly use. */
function titlesOf(entry: KomikuResult): string[] {
  if (!isRealResult(entry)) return [];
  const t = str(entry.title) ?? str(entry.judul) ?? str(entry.name);
  return t ? [t] : [];
}

/**
 * Searches a Komiku instance and returns the best-matching raw result entry
 * (with `slug` intact) or null when disabled, the request fails, or no result
 * is a confident title match. Shared by fetchKomikuInfo and komikuChapters.ts.
 */
export async function searchKomikuMatch(title: string, env: Env): Promise<KomikuResult | null> {
  const base = komikuBase(env);
  if (!base) return null; // source disabled — silently skipped

  const url = `${base}/search?q=${encodeURIComponent(title)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "komik-tracker-worker/1.0 (personal comic tracker)" },
    });
  } catch (err) {
    console.error(`searchKomikuMatch: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`searchKomikuMatch: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as unknown;
  const entries = extractEntries(body);
  if (entries.length === 0) {
    console.error(`searchKomikuMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, titlesOf);
  if (!match) {
    console.error(`searchKomikuMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}

function coverOf(entry: KomikuResult): string | null {
  return str(entry.thumbnail) ?? str(entry.image) ?? str(entry.cover) ?? str(entry.img) ?? null;
}

function typeTagOf(entry: KomikuResult): TypeTag | null {
  const raw = (str(entry.type) ?? str(entry.jenis) ?? "").toLowerCase();
  if (raw.includes("manhwa")) return "manhwa";
  if (raw.includes("manhua")) return "manhua";
  if (raw.includes("manga")) return "manga";
  return null;
}

/**
 * Looks up a comic on a Komiku instance. Returns null when the source is
 * disabled (no env), the request fails, or no result is a confident title
 * match (shared acceptance rule — lib/titleMatch.ts).
 */
export async function fetchKomikuInfo(title: string, env: Env): Promise<MangaDexInfo | null> {
  const match = await searchKomikuMatch(title, env);
  if (!match) return null;
  return { cover_url: coverOf(match), type_tag: typeTagOf(match) };
}

/** The list of results might sit at the top level or under data/results/komik. */
function extractEntries(body: unknown): KomikuResult[] {
  if (Array.isArray(body)) return body as KomikuResult[];
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["data", "results", "komik", "manga"]) {
      if (Array.isArray(obj[key])) return obj[key] as KomikuResult[];
    }
  }
  return [];
}
