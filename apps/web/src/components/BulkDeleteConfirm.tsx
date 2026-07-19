import { useState } from "react";
import type { Comic } from "../types/comic";

interface BulkDeleteConfirmProps {
  comics: Comic[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Konfirmasi ulang eksplisit untuk bulk-delete: menampilkan daftar judul yang
 * akan dihapus + tombol merah. Terpisah dari action bar supaya penghapusan
 * tidak pernah terpicu satu klik.
 */
export function BulkDeleteConfirm({ comics, onConfirm, onCancel }: BulkDeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus komik.");
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg bg-slate-800 p-4">
        <h2 className="mb-2 text-base font-semibold text-slate-100">
          Hapus {comics.length} komik?
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Tindakan ini permanen dan tidak bisa dibatalkan. Komik berikut akan dihapus:
        </p>
        <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-700 bg-slate-900/60 p-2 text-sm text-slate-200">
          {comics.map((comic) => (
            <li key={comic.comic_id} className="truncate" title={comic.title}>
              • {comic.title}
            </li>
          ))}
        </ul>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {deleting ? "Menghapus…" : `Ya, hapus ${comics.length} komik`}
          </button>
        </div>
      </div>
    </div>
  );
}
