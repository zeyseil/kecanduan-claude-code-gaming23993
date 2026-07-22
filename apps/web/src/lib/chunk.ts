/** Pecah array jadi potongan berukuran `size` (potongan terakhir bisa lebih kecil).
 * Dipakai bersama oleh operasi jaringan yang dibatasi ukuran request Worker
 * (bulk import, bulk delete, backfill cover). */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
