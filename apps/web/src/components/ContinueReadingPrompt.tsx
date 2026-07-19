import { useState } from "react";
import type { Comic } from "../types/comic";

interface ContinueReadingPromptProps {
  comic: Comic;
  onUpdate: (latestChapter: number) => Promise<void>;
  onDismiss: () => void;
}

/**
 * Muncul saat user kembali ke tab aplikasi setelah membuka link baca dari
 * HeroBanner. Angka chapter diisi manual oleh user — aplikasi tidak tahu
 * berapa chapter yang benar-benar terbaca di situs eksternal.
 */
export function ContinueReadingPrompt({ comic, onUpdate, onDismiss }: ContinueReadingPromptProps) {
  const [chapter, setChapter] = useState(String(comic.latest_chapter + 1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(chapter);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Nomor chapter tidak valid.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onUpdate(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengupdate chapter.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-slate-800 p-4">
        <h2 className="mb-1 text-base font-semibold text-slate-100">Selesai baca?</h2>
        <p className="mb-3 text-sm text-slate-400" title={comic.title}>
          <span className="line-clamp-1">{comic.title}</span> — chapter berapa yang sudah dibaca?
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="number"
            step="any"
            min="0"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            autoFocus
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
          />

          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
            <p className="mb-1 font-medium text-slate-300">Batasan fitur ini:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Aplikasi tidak tahu chapter berapa yang benar-benar Anda baca — nomor di atas
                diisi manual, bukan dideteksi dari halaman baca.
              </li>
              <li>Prompt ini hanya muncul dari tab yang dibuka lewat tombol "Lanjutkan Membaca".</li>
            </ul>
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={submitting}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-60"
            >
              Belum selesai
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? "Menyimpan…" : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
