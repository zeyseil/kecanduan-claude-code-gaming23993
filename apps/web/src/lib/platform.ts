import { isTauri } from "@tauri-apps/api/core";
import { Capacitor } from "@capacitor/core";

/** Wrapper desktop (window webview custom-protocol, tanpa SPA-fallback server). */
export function isTauriApp(): boolean {
  return isTauri();
}

/** Wrapper Android (WebView lokal, juga tanpa SPA-fallback server seperti Cloudflare Pages `_redirects`). */
export function isCapacitorApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * true untuk KEDUA wrapper native (Tauri desktop, Capacitor Android) — dipakai
 * untuk keputusan yang sama-sama berlaku ke keduanya, mis. HashRouter (baik
 * Tauri maupun Capacitor tidak punya server-side rewrite untuk deep link).
 */
export function isNativeApp(): boolean {
  return isTauriApp() || isCapacitorApp();
}
