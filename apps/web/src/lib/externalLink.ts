import type { MouseEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Browser } from "@capacitor/browser";
import { isTauriApp, isCapacitorApp } from "./platform";

/**
 * Webview Tauri tidak punya address bar — `<a target="_blank">` default akan
 * membuka window webview baru DI DALAM app, bukan browser sistem. Capacitor
 * Android punya masalah serupa: link ke luar `server.url` otomatis dibuka lewat
 * Intent ke browser eksternal (app keluar total) kecuali kita pakai
 * `@capacitor/browser` untuk membuka in-app Custom Tab. Di luar Tauri/Capacitor
 * (browser biasa) fungsi ini no-op supaya perilaku <a> asli tetap jalan.
 *
 * Pakai plugin-opener (openUrl) untuk Tauri, BUKAN plugin-shell (open) —
 * plugin-shell dikonfirmasi lewat riset punya bug dikenal di Windows (klik/open
 * bisa terpicu dobel, membuka 2 tab browser sekaligus). plugin-opener adalah
 * pengganti resmi yang direkomendasikan Tauri untuk kasus buka-URL ini.
 */
export function handleExternalLinkClick(href: string, event: MouseEvent<HTMLAnchorElement>): void {
  if (isTauriApp()) {
    event.preventDefault();
    void openUrl(href);
    return;
  }
  if (isCapacitorApp()) {
    event.preventDefault();
    void Browser.open({ url: href });
  }
}
