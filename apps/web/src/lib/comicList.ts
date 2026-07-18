import type { Comic, Status, TypeTag } from "../types/comic";

export type SortKey = "recent" | "alpha" | "type";

export interface ComicListOptions {
  search: string;
  typeFilter: TypeTag | "all";
  statusFilter: Status | "all";
  sort: SortKey;
}

export const DEFAULT_OPTIONS: ComicListOptions = {
  search: "",
  typeFilter: "all",
  statusFilter: "all",
  sort: "recent",
};

/** Cocokkan query ke judul + aliases, case-insensitive, trim. */
function matchesSearch(comic: Comic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  if (comic.title.toLowerCase().includes(q)) return true;
  return comic.aliases.some((a) => a.toLowerCase().includes(q));
}

/** Terbaru diupdate lebih dulu. */
function sortByRecent(a: Comic, b: Comic): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function bySort(sort: SortKey): (a: Comic, b: Comic) => number {
  switch (sort) {
    case "alpha":
      return (a, b) => a.title.localeCompare(b.title);
    case "type":
      // Urutkan berdasarkan jenis, lalu judul agar deterministik.
      return (a, b) =>
        a.type_tag.localeCompare(b.type_tag) || a.title.localeCompare(b.title);
    case "recent":
    default:
      return sortByRecent;
  }
}

/** Ambil `limit` komik paling baru diupdate/ditambahkan, tanpa memutasi input. */
export function selectRecent(comics: Comic[], limit: number): Comic[] {
  return comics.slice().sort(sortByRecent).slice(0, limit);
}

/**
 * Terapkan search + filter + sort secara murni (tidak memutasi input).
 * Dipakai halaman Daftar Komik lewat useMemo.
 */
export function selectComics(
  comics: Comic[],
  options: ComicListOptions,
): Comic[] {
  const { search, typeFilter, statusFilter, sort } = options;
  return comics
    .filter((c) => matchesSearch(c, search))
    .filter((c) => typeFilter === "all" || c.type_tag === typeFilter)
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .slice()
    .sort(bySort(sort));
}
