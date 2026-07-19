import type { Comic } from "../types/comic";
import type { SimilarityCandidate } from "./fuzzyMatch";

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
  searchComics(userId: string, candidateTitle: string): Promise<SimilarityCandidate[]>;
  /** Admin-only: comic count per user across ALL partitions. Pulls only
   * `user_id` (never titles/covers) so no other user's content leaks. */
  countComicsPerUser(): Promise<Array<{ user_id: string; count: number }>>;
}
