import type { Comic, TypeTag } from "../../types/comic";
import type { ParsedEntry } from "../parseHistoris";
import { apiFetch } from "./client";

export interface DetectTypeResultItem {
  title: string;
  type_tag: TypeTag | null;
  reason?: string;
  /** Set only alongside a resolved type_tag — the same fetchComicInfo() call
   * that found the type already found (or didn't find) a cover. */
  cover_url?: string | null;
  source_api?: string | null;
}

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787";

export interface NewComicInput {
  title: string;
  type_tag: TypeTag;
  /** Field terpisah dari type_tag — lihat types/comic.ts. */
  is_adult: boolean;
  latest_chapter: number;
  /** Data URL hasil crop, atau null kalau user belum pilih gambar. */
  cover_url: string | null;
  /** URL tempat user membaca komik ini. null/kosong kalau belum diisi. */
  read_url: string | null;
  /** Hari rilis mingguan (0=Minggu … 6=Sabtu). null kalau tidak diketahui. */
  release_day: number | null;
  /** Catatan bebas user. null kalau kosong. */
  note: string | null;
}

export async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return `Request gagal (${res.status})`;
}

export async function fetchComics(): Promise<Comic[]> {
  const res = await apiFetch(`${BASE_URL}/comics`);
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<Comic[]>;
}

export type ComicPatch = Partial<
  Pick<
    Comic,
    | "title"
    | "aliases"
    | "type_tag"
    | "is_adult"
    | "latest_chapter"
    | "status"
    | "cover_url"
    | "read_url"
    | "release_day"
    | "note"
  >
>;

export async function patchComic(id: string, patch: ComicPatch): Promise<Comic> {
  const res = await apiFetch(`${BASE_URL}/comics/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<Comic>;
}

export async function deleteComic(id: string): Promise<void> {
  const res = await apiFetch(`${BASE_URL}/comics/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
}

export async function postComic(input: NewComicInput): Promise<Comic> {
  // Entry manual selalu berstatus ongoing — lihat aturan lama di createComic.ts.
  const res = await apiFetch(`${BASE_URL}/comics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, status: "ongoing" }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<Comic>;
}

export interface BulkImportResultItem {
  title: string;
  action: "created" | "updated" | "skipped" | "error";
  comic_id?: string;
  reason?: string;
  /** Present (possibly null) only for "created" — lets the client skip
   * backfill-covers for entries that already got a cover from detect-type. */
  cover_url?: string | null;
}

/** Deterministic import from parsed historical data — no AI involved. */
export async function bulkImportComics(entries: ParsedEntry[]): Promise<BulkImportResultItem[]> {
  const res = await apiFetch(`${BASE_URL}/comics/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const body = (await res.json()) as { results: BulkImportResultItem[] };
  return body.results;
}

export interface BulkDeleteResultItem {
  comic_id: string;
  deleted: boolean;
}

/** Hapus banyak komik sekaligus (maks 25). Hasil per-item — id yang sudah hilang tidak menggagalkan batch. */
export async function bulkDeleteComics(comicIds: string[]): Promise<BulkDeleteResultItem[]> {
  const res = await apiFetch(`${BASE_URL}/comics/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comic_ids: comicIds }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const body = (await res.json()) as { results: BulkDeleteResultItem[] };
  return body.results;
}

export interface CoverBackfillResultItem {
  comic_id: string;
  cover_url: string | null;
  reason?: string;
}

export async function backfillCovers(comicIds: string[]): Promise<CoverBackfillResultItem[]> {
  const res = await apiFetch(`${BASE_URL}/comics/backfill-covers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comic_ids: comicIds }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const body = (await res.json()) as { results: CoverBackfillResultItem[] };
  return body.results;
}

/** Auto-detect comic type from MangaDex for import lines that lack (jenis). */
export async function detectTypes(titles: string[]): Promise<DetectTypeResultItem[]> {
  const res = await apiFetch(`${BASE_URL}/comics/detect-type`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titles }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const body = (await res.json()) as { results: DetectTypeResultItem[] };
  return body.results;
}
