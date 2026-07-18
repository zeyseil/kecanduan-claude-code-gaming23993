import { useState } from "react";
import type { Comic } from "../types/comic";

interface UpdateChapterFormProps {
  comic: Comic;
  onSubmit: (latestChapter: number) => Promise<void>;
  onCancel: () => void;
}

export function UpdateChapterForm({ comic, onSubmit, onCancel }: UpdateChapterFormProps) {
  const [chapter, setChapter] = useState(String(comic.latest_chapter));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const chapterValue = Number(chapter);
    if (chapter.trim() === "" || Number.isNaN(chapterValue) || chapterValue <= 0) {
      setError("Chapter terakhir harus berupa angka lebih dari 0.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(chapterValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan chapter.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Chapter Terakhir Dibaca
        <input
          type="number"
          step="0.5"
          min="0"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </form>
  );
}
