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
  created_at: string;
  updated_at: string;
}

export const TYPE_TAGS: readonly TypeTag[] = ["manga", "manhwa", "manhua"];
export const STATUSES: readonly Status[] = ["ongoing", "completed"];
