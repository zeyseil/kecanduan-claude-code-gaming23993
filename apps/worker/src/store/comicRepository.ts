import type { Comic } from "../types/comic";

export interface ComicRepository {
  listComics(userId: string): Promise<Comic[]>;
  insertComic(userId: string, comic: Comic): Promise<Comic>;
  findComic(userId: string, comicId: string): Promise<Comic | undefined>;
  updateComic(
    userId: string,
    comicId: string,
    patch: Partial<Omit<Comic, "comic_id" | "created_at">>,
  ): Promise<Comic | undefined>;
  deleteComic(userId: string, comicId: string): Promise<boolean>;
}
