import type { Comic } from "../types/comic";
import { formatChapter } from "./format";

// Format per komik (dipilih user):
//   ---
//   Solo Leveling | manhwa | ch200 | 18+
//   ---
// Kolom terakhir "18+" hanya ada kalau is_adult; selain itu dikosongkan.

/** Bangun satu baris data untuk satu komik. */
function comicLine(comic: Comic): string {
  const chapter = `ch${formatChapter(comic.latest_chapter)}`;
  const adult = comic.is_adult ? "18+" : "";
  return `${comic.title} | ${comic.type_tag} | ${chapter} | ${adult}`;
}

/** Susun seluruh isi file .md. Fungsi murni — mudah diuji tanpa DOM. */
export function buildMarkdown(comics: Comic[]): string {
  if (comics.length === 0) return "---\n";
  const body = comics.map((comic) => `---\n${comicLine(comic)}`).join("\n");
  return `${body}\n---\n`;
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
