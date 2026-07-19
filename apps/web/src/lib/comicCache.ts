// Cache daftar komik di localStorage — pola stale-while-revalidate: Daftar
// Komik langsung merender data cache saat mount (tanpa skeleton), lalu hasil
// fetch Worker menggantikannya diam-diam. Skeleton hanya muncul di kunjungan
// pertama (cache kosong).
//
// Pakai globalThis.localStorage (bukan window/localStorage polos) — pola wajib
// codebase ini, lihat lib/storage.ts (Node + jsdom bentrok pada global storage).

import type { Comic } from "../types/comic";

const CACHE_KEY = "komik-tracker:comics-cache";

export function readComicCache(): Comic[] | null {
  try {
    const raw = globalThis.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Comic[]) : null;
  } catch {
    // Cache korup / storage tidak tersedia → anggap tidak ada.
    return null;
  }
}

export function writeComicCache(comics: Comic[]): void {
  try {
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify(comics));
  } catch {
    // Quota penuh / storage tidak tersedia — cache opsional, jangan crash.
  }
}

/** Dipanggil saat token berganti/dicabut (login & 401) supaya data user lama
 * tidak pernah tampil untuk token berikutnya. */
export function clearComicCache(): void {
  try {
    globalThis.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
