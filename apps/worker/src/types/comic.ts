// Mirror of apps/web/src/types/comic.ts — keep in sync until a shared package exists.
export type TypeTag = "manga" | "manhwa" | "manhua";
export type Status = "ongoing" | "completed";

export interface Comic {
  comic_id: string;
  title: string;
  aliases: string[];
  type_tag: TypeTag;
  is_adult: boolean;
  latest_chapter: number;
  status: Status;
  cover_url: string | null;
  /** URL tempat user membaca komik ini. null kalau belum diisi. Tidak pernah diisi AI. */
  read_url: string | null;
  /** Hari rilis mingguan (0=Minggu … 6=Sabtu). null kalau tidak diketahui/tidak rutin. */
  release_day: number | null;
  /** Catatan bebas user (mis. "hiatus", "S1 end", "baca di warungkomik").
   * null kalau tidak ada. Tidak pernah diisi AI. */
  note: string | null;
  /** Asal metadata cover: "mangadex" | "comick" | "anilist" | "komiku" |
   * gabungan (mis. "mangadex+anilist") | "manual" | null (belum pernah di-fetch).
   * Opsional — dokumen lama tanpa field ini dinormalisasi ke null saat dibaca. */
  source_api?: string | null;
  created_at: string;
  updated_at: string;
}

export const TYPE_TAGS: readonly TypeTag[] = ["manga", "manhwa", "manhua"];
export const STATUSES: readonly Status[] = ["ongoing", "completed"];
