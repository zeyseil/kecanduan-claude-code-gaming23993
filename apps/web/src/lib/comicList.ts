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

/** Jumlah card per halaman grid — di bawah 40 supaya scroll tidak terlalu panjang. */
export const PAGE_SIZE = 35;

export interface PaginateResult {
  items: Comic[];
  totalPages: number;
}

/**
 * Potong `comics` (yang sudah difilter+diurutkan) jadi satu halaman.
 * `page` di luar rentang (mis. setelah filter mempersempit hasil) di-clamp
 * ke halaman terakhir yang valid, bukan mengembalikan array kosong.
 */
export function paginate(comics: Comic[], page: number): PaginateResult {
  const totalPages = Math.max(1, Math.ceil(comics.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * PAGE_SIZE;
  return { items: comics.slice(start, start + PAGE_SIZE), totalPages };
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
