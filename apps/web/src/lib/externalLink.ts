import type { MouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

/**
 * Webview Tauri tidak punya address bar — `<a target="_blank">` default akan
 * membuka window webview baru DI DALAM app, bukan browser sistem. Di luar
 * Tauri (browser biasa) fungsi ini no-op supaya perilaku <a> asli tetap jalan.
 */
export function handleExternalLinkClick(href: string, event: MouseEvent<HTMLAnchorElement>): void {
  if (!isTauri()) return;
  event.preventDefault();
  void open(href);
}
