import type { Comic, TypeTag } from "../../types/comic";

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787";

export interface NewComicInput {
  title: string;
  type_tag: TypeTag;
  /** Field terpisah dari type_tag — lihat types/comic.ts. */
  is_adult: boolean;
  latest_chapter: number;
  /** Data URL hasil crop, atau null kalau user belum pilih gambar. */
  cover_url: string | null;
}

async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return `Request gagal (${res.status})`;
}

export async function fetchComics(): Promise<Comic[]> {
  const res = await fetch(`${BASE_URL}/comics`);
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<Comic[]>;
}

export type ComicPatch = Partial<
  Pick<Comic, "title" | "aliases" | "type_tag" | "is_adult" | "latest_chapter" | "status" | "cover_url">
>;

export async function patchComic(id: string, patch: ComicPatch): Promise<Comic> {
  const res = await fetch(`${BASE_URL}/comics/${id}`, {
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
  const res = await fetch(`${BASE_URL}/comics/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
}

export async function postComic(input: NewComicInput): Promise<Comic> {
  // Entry manual selalu berstatus ongoing — lihat aturan lama di createComic.ts.
  const res = await fetch(`${BASE_URL}/comics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, status: "ongoing" }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  return res.json() as Promise<Comic>;
}
