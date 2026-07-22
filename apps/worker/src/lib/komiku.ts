// Komiku API lookup — fourth external metadata source, last in the fallback
// chain. Good for Indonesian/local titles that aren't on MangaDex/AniList.
//
// The VernSG Komiku REST API is a scraper whose /search JSON shape isn't
// formally documented, so this adapter is deliberately DEFENSIVE: it accepts
// several plausible field names for title/cover/type and returns null on any
// mismatch rather than throwing. Gated on `env.KOMIKU_API_URL` (no-op if unset)
// so a wrong/absent instance never breaks the pipeline — set the URL of a
// running instance to enable it.

import type { Env } from "../env";
import type { TypeTag } from "../types/comic";
import type { MangaDexInfo } from "./mangadex";
import { pickBestTitleMatch } from "./titleMatch";

interface KomikuResult {
  [key: string]: unknown;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Title strings under any of the field names Komiku scrapers commonly use. */
function titlesOf(entry: KomikuResult): string[] {
  const t = str(entry.title) ?? str(entry.judul) ?? str(entry.name);
  return t ? [t] : [];
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
  const base = env.KOMIKU_API_URL?.trim();
  if (!base) return null; // source disabled — silently skipped

  const url = `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(title)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "komik-tracker-worker/1.0 (personal comic tracker)" },
    });
  } catch (err) {
    console.error(`fetchKomikuInfo: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`fetchKomikuInfo: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as unknown;
  const entries = extractEntries(body);
  if (entries.length === 0) {
    console.error(`fetchKomikuInfo: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, titlesOf);
  if (!match) {
    console.error(`fetchKomikuInfo: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }

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
