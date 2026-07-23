import { isTauri } from "@tauri-apps/api/core";
import type { Comic } from "../types/comic";
import { markReadingStarted } from "./readingSession";
import { startInAppReading } from "./floatingReader";

/**
 * Membuka read_url komik untuk tombol non-anchor (mis. tombol Baca di card yang
 * di-spotlight). Di Tauri: window reader in-app + companion always-on-top. Web
 * biasa: tandai sesi baca lalu buka tab baru. No-op kalau read_url kosong.
 *
 * HeroBanner sengaja TIDAK memakai helper ini — ia tetap pakai <a target="_blank">
 * untuk semantik web (middle-click, dsb). Cabang Tauri di sini menduplikasi
 * pemicu HeroBanner secara sadar demi blast radius kecil.
 */
export function launchReading(comic: Comic): void {
  const readUrl = comic.read_url;
  if (!readUrl) return;

  if (isTauri()) {
    void startInAppReading(comic, readUrl);
    return;
  }
  markReadingStarted(comic.comic_id);
  window.open(readUrl, "_blank", "noopener,noreferrer");
}
