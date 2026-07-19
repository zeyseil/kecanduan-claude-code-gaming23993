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
  created_at: string;
  updated_at: string;
}

export const TYPE_TAGS: readonly TypeTag[] = ["manga", "manhwa", "manhua"];
export const STATUSES: readonly Status[] = ["ongoing", "completed"];
