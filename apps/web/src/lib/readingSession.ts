const READING_SESSION_KEY = "komik-tracker:reading-session";

/**
 * Menandai bahwa user membuka link baca sebuah komik dari dalam aplikasi.
 * Dipakai untuk memunculkan prompt "sudah selesai baca?" saat user kembali ke
 * tab aplikasi. Disimpan di sessionStorage (bukan localStorage) supaya prompt
 * tidak muncul lagi berhari-hari kemudian — hanya relevan untuk sesi tab ini.
 *
 * Pola `globalThis.sessionStorage` (bukan `sessionStorage` polos) dipakai
 * konsisten dengan lib/storage.ts karena Node + jsdom di environment ini
 * bentrok pada global storage bawaan saat testing.
 */
export function markReadingStarted(comicId: string): void {
  globalThis.sessionStorage.setItem(READING_SESSION_KEY, comicId);
}

/** Ambil comic_id sesi baca yang tertunda lalu hapus (sekali pakai). */
export function takeReadingSession(): string | null {
  const value = globalThis.sessionStorage.getItem(READING_SESSION_KEY);
  if (value !== null) {
    globalThis.sessionStorage.removeItem(READING_SESSION_KEY);
  }
  return value;
}
