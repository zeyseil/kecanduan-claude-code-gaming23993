import { Browser } from "@capacitor/browser";
import type { Comic } from "../types/comic";
import { markReadingStarted } from "./readingSession";
import { startInAppReading } from "./floatingReader";
import { isTauriApp, isCapacitorApp } from "./platform";

/**
 * Membuka read_url komik untuk tombol non-anchor (mis. tombol Baca di card yang
 * di-spotlight). Di Tauri: window reader in-app + companion always-on-top. Di
 * Capacitor (Android): in-app Custom Tab (@capacitor/browser) + tandai sesi
 * baca — TIDAK ada companion window ala desktop (tidak feasible di Android
 * tanpa Activity kustom), ContinueReadingPrompt (via visibilitychange saat
 * Custom Tab ditutup) yang menggantikan perannya. Web biasa: tandai sesi baca
 * lalu buka tab baru. No-op kalau read_url kosong.
 *
 * HeroBanner sengaja TIDAK memakai helper ini — ia tetap pakai <a target="_blank">
 * untuk semantik web (middle-click, dsb). Cabang Tauri/Capacitor di sini
 * menduplikasi pemicu HeroBanner secara sadar demi blast radius kecil.
 */
export function launchReading(comic: Comic): void {
  const readUrl = comic.read_url;
  if (!readUrl) return;

  if (isTauriApp()) {
    void startInAppReading(comic, readUrl);
    return;
  }
  if (isCapacitorApp()) {
    markReadingStarted(comic.comic_id);
    void Browser.open({ url: readUrl });
    return;
  }
  markReadingStarted(comic.comic_id);
  window.open(readUrl, "_blank", "noopener,noreferrer");
}
