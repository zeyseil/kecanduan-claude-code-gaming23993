import type { Comic } from "../types/comic";
import { formatChapter } from "./format";

// Format per komik — SENGAJA mengikuti sintaks yang diharapkan parser Import
// Historis (lib/parseHistoris.ts), supaya file hasil export bisa ditempel
// balik ke Bulk Import dan terbaca (roundtrip), bukan hanya untuk dibaca
// manusia:
//   Judul(jenis18) : chN(status_atau_catatan)
// - Suffix "18" pada jenis = is_adult (konvensi yang sama dipakai parser
//   import untuk data historis, lihat parseTypeTag).
// - Bagian kurung setelah chapter: "completed" kalau status Tamat, ATAU
//   catatan (`note`) kalau ada dan status Ongoing. Parser hanya mendukung
//   SATU keterangan di posisi itu — kombinasi status Tamat DENGAN catatan
//   TIDAK bisa dipertahankan lewat roundtrip ini (catatan akan hilang),
//   ini batasan sintaks parser, bukan bug export.
// - Judul yang mengandung "(" atau ":" akan salah ter-parse kalau diimpor
//   ulang (parser memakai karakter itu sebagai delimiter) — batasan yang
//   sama seperti data historis manual.

/** Bangun satu baris data untuk satu komik. */
function comicLine(comic: Comic): string {
  const typeWithAdult = comic.is_adult ? `${comic.type_tag}18` : comic.type_tag;
  const chapter = formatChapter(comic.latest_chapter);
  const trailing =
    comic.status === "completed" ? "(completed)" : comic.note ? `(${comic.note})` : "";
  return `${comic.title}(${typeWithAdult}) : ch${chapter}${trailing}`;
}

/** Susun seluruh isi file .md. Fungsi murni — mudah diuji tanpa DOM. */
export function buildMarkdown(comics: Comic[]): string {
  return comics.map((comic) => comicLine(comic)).join("\n");
}

/** Nama file dengan tanggal hari ini: komik-terbaca-YYYY-MM-DD.md */
export function exportFileName(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `komik-terbaca-${date}.md`;
}

/**
 * Picu unduhan file .md di browser dari daftar komik.
 * Dipisah dari buildMarkdown supaya logika format tetap testable tanpa DOM.
 */
export function downloadMarkdown(comics: Comic[]): void {
  const blob = new Blob([buildMarkdown(comics)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFileName();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
