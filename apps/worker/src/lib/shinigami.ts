// Shinigami Scans lookup — used only by shinigamiChapters.ts to find a comic's
// manga_id for the "Cari link chapter berikutnya" feature. Shinigami is an
// Indonesian scanlation site, so its chapters are in Bahasa Indonesia — this is
// the point of adding it (comick.dev/MangaDex only cover English).
//
// Unlike comick (Cloudflare-gated, needs a browser UA), Shinigami exposes an
// OPEN JSON backend at api.shngm.io — verified live while planning: a plain
// fetch (no special headers) returns 200 JSON. We still send an identifying UA
// as a polite guest, like mangadex.ts.
//
// Search response shape (verified live):
//   GET {base}/v1/manga/list?page=1&page_size=10&q={title}
//   -> { data: [{ manga_id, title, alternative_title, country_id, ... }], ... }
// The frontend host (g.shinigami.asia) blocks bots, but the API host does not.
// `manga_id` is a UUID; alt titles help match against the user's stored title.

import type { Env } from "../env";
import { pickBestTitleMatch } from "./titleMatch";

const DEFAULT_BASE = "https://api.shngm.io";

// Polite, identifiable UA — the API is open, but we don't hide who's calling.
export const SHINIGAMI_UA = "komik-tracker-worker/1.0 (+https://komik-tracker.pages.dev)";

export interface ShinigamiManga {
  /** Shinigami's stable UUID — used by shinigamiChapters.ts to list this comic's chapters. */
  manga_id?: string;
  title?: string;
  alternative_title?: string;
}

interface ShinigamiListResponse {
  data?: ShinigamiManga[];
}

/** Base host resolution — Shinigami has changed mirror domains before
 * (g/d/dev.shinigami.asia), so the API base is overridable via env. */
export function shinigamiBase(env: Env): string {
  return (env.SHINIGAMI_API_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

/** Reader (frontend) base for building a per-chapter URL. Overridable since the
 * public mirror domain shifts; chapters open in the user's browser. */
export function shinigamiReaderBase(env: Env): string {
  return (env.SHINIGAMI_READER_URL?.trim() || "https://g.shinigami.asia").replace(/\/$/, "");
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Primary title plus alternative_title (Shinigami stores one alt-title string). */
function titlesOf(entry: ShinigamiManga): string[] {
  return [str(entry.title), str(entry.alternative_title)].filter((t): t is string => t !== undefined);
}

/**
 * Searches Shinigami by title and returns the best-matching manga (raw, with
 * `manga_id` intact) or null if the request fails or no result is a confident
 * title match (shared acceptance rule — lib/titleMatch.ts).
 */
export async function searchShinigamiMatch(title: string, env: Env): Promise<ShinigamiManga | null> {
  const base = shinigamiBase(env);
  const url = `${base}/v1/manga/list?page=1&page_size=10&q=${encodeURIComponent(title)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": SHINIGAMI_UA } });
  } catch (err) {
    console.error(`searchShinigamiMatch: request error for "${title}": ${String(err)}`);
    return null;
  }
  if (!res.ok) {
    console.error(`searchShinigamiMatch: search failed (${res.status} ${res.statusText}) for "${title}"`);
    return null;
  }

  const body = (await res.json().catch(() => null)) as ShinigamiListResponse | null;
  const entries = Array.isArray(body?.data) ? body.data : [];
  if (entries.length === 0) {
    console.error(`searchShinigamiMatch: no result for "${title}"`);
    return null;
  }

  const match = pickBestTitleMatch(entries, title, titlesOf);
  if (!match) {
    console.error(`searchShinigamiMatch: kandidat untuk "${title}" tidak lolos ambang kemiripan`);
    return null;
  }
  return match;
}
