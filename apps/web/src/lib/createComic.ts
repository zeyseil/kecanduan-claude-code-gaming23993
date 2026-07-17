import type { Comic, TypeTag } from "../types/comic";

export interface NewComicInput {
  title: string;
  type_tag: TypeTag;
  /** Field terpisah dari type_tag — lihat types/comic.ts. */
  is_adult: boolean;
  latest_chapter: number;
  /** Data URL hasil crop, atau null kalau user belum pilih gambar. */
  cover_url: string | null;
}

/** Bangun Comic baru dari input form manual. Entry manual selalu berstatus ongoing. */
export function createComic(input: NewComicInput, now: Date = new Date()): Comic {
  const iso = now.toISOString();
  return {
    comic_id: crypto.randomUUID(),
    title: input.title,
    aliases: [],
    type_tag: input.type_tag,
    is_adult: input.is_adult,
    latest_chapter: input.latest_chapter,
    status: "ongoing",
    cover_url: input.cover_url,
    created_at: iso,
    updated_at: iso,
  };
}
