import type { Comic } from "../types/comic";

interface NsfwRevealConfirmProps {
  comic: Comic;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Konfirmasi sekali sebelum membuka cover 18+ yang sedang disensor (Mode Aman). */
export function NsfwRevealConfirm({ comic, onConfirm, onCancel }: NsfwRevealConfirmProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg border border-rose-800 bg-slate-800 p-4">
        <h2 className="mb-2 text-base font-semibold text-rose-300">Konten dewasa (18+)</h2>
        <p className="text-sm text-slate-300">
          Cover <span className="font-medium text-slate-100">{comic.title}</span> ditandai konten
          NSFW. Tampilkan cover ini?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500"
          >
            Ya, tampilkan
          </button>
        </div>
      </div>
    </div>
  );
}
