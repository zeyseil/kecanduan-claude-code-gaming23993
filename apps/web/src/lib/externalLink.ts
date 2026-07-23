import type { MouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Webview Tauri tidak punya address bar — `<a target="_blank">` default akan
 * membuka window webview baru DI DALAM app, bukan browser sistem. Di luar
 * Tauri (browser biasa) fungsi ini no-op supaya perilaku <a> asli tetap jalan.
 *
 * Pakai plugin-opener (openUrl), BUKAN plugin-shell (open) — plugin-shell
 * dikonfirmasi lewat riset punya bug dikenal di Windows (klik/open bisa
 * terpicu dobel, membuka 2 tab browser sekaligus). plugin-opener adalah
 * pengganti resmi yang direkomendasikan Tauri untuk kasus buka-URL ini.
 */
export function handleExternalLinkClick(href: string, event: MouseEvent<HTMLAnchorElement>): void {
  if (!isTauri()) return;
  event.preventDefault();
  void openUrl(href);
}
