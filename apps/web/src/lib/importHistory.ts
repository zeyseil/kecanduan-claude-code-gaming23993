// Riwayat impor historis nyata (bukan mockup) — dicatat ke localStorage tiap
// event impor sungguhan (sukses/gagal), device-only. Pakai globalThis.localStorage
// (pola wajib codebase ini, lihat lib/storage.ts).

const HISTORY_KEY = "komik-tracker:import-history";
const MAX_ENTRIES = 10;

export interface ImportHistoryEntry {
  status: "success" | "error";
  message: string;
  timestamp: number;
}

export function getImportHistory(): ImportHistoryEntry[] {
  try {
    const raw = globalThis.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function logImportEvent(entry: { status: "success" | "error"; message: string }): void {
  try {
    const history = getImportHistory();
    const next = [{ ...entry, timestamp: Date.now() }, ...history].slice(0, MAX_ENTRIES);
    globalThis.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Storage tidak tersedia / quota penuh — riwayat opsional, jangan crash.
  }
}
