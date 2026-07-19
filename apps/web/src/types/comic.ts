// Single source of truth untuk bentuk data komik di frontend.
// Sengaja mengikuti data model SPEC.md §5: is_adult TERPISAH dari type_tag,
// latest_chapter numeric (boleh desimal), status enum tertutup.

/** Jenis dasar komik. TIDAK memuat varian 18+ — itu field is_adult terpisah. */
export type TypeTag = "manga" | "manhwa" | "manhua";

export type Status = "ongoing" | "completed";

export interface Comic {
  comic_id: string;
  title: string;
  /** Variasi judul yang pernah dipakai user (histori fuzzy match). */
  aliases: string[];
  type_tag: TypeTag;
  /** true kalau komik 18+. Field terpisah, JANGAN digabung ke type_tag. */
  is_adult: boolean;
  /** Mendukung desimal, mis. 11.5. */
  latest_chapter: number;
  status: Status;
  /** null kalau cover belum ditemukan/di-upload — UI menampilkan placeholder. */
  cover_url: string | null;
  /** URL tempat user membaca komik ini. null kalau belum diisi. Tidak pernah diisi AI. */
  read_url: string | null;
  /** Hari rilis mingguan (0=Minggu … 6=Sabtu). null kalau tidak diketahui/tidak rutin. */
  release_day: number | null;
  /** Catatan bebas user (mis. "hiatus", "S1 end", "baca di warungkomik").
   * null kalau tidak ada. Tidak pernah diisi AI. */
  note: string | null;
  /** ISO 8601 timestamp. */
  created_at: string;
  updated_at: string;
}

export const TYPE_TAGS: readonly TypeTag[] = ["manga", "manhwa", "manhua"];
export const STATUSES: readonly Status[] = ["ongoing", "completed"];

/** Index 0=Minggu … 6=Sabtu, cocok dengan Date.getDay(). */
export const RELEASE_DAY_LABELS: readonly string[] = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
