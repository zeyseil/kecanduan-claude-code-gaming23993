import { useRef, useState } from "react";
import type { TypeTag } from "../types/comic";
import { RELEASE_DAY_LABELS, TYPE_TAGS } from "../types/comic";
import type { NewComicInput } from "../lib/api/comics";
import { readFileAsDataUrl } from "../lib/cropImage";
import { CoverDropzone } from "./CoverDropzone";
import { ImageCropModal } from "./ImageCropModal";

const TYPE_LABEL: Record<TypeTag, string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface AddComicFormProps {
  onSubmit: (input: NewComicInput) => Promise<void>;
  onCancel: () => void;
}

export function AddComicForm({ onSubmit, onCancel }: AddComicFormProps) {
  const [title, setTitle] = useState("");
  const [typeTag, setTypeTag] = useState<TypeTag>("manga");
  const [isAdult, setIsAdult] = useState(false);
  const [chapter, setChapter] = useState("");
  const [readUrl, setReadUrl] = useState("");
  const [releaseDay, setReleaseDay] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pendingCropSrc, setPendingCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (file: File) => {
    setCoverBusy(true);
    try {
      setPendingCropSrc(await readFileAsDataUrl(file));
    } catch {
      setError("Gagal membaca file gambar.");
      setCoverBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const chapterValue = Number(chapter);

    if (trimmedTitle === "") {
      setError("Nama komik wajib diisi.");
      return;
    }
    if (chapter.trim() === "" || Number.isNaN(chapterValue) || chapterValue <= 0) {
      setError("Chapter terakhir harus berupa angka lebih dari 0.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        type_tag: typeTag,
        is_adult: isAdult,
        latest_chapter: chapterValue,
        cover_url: coverUrl,
        read_url: readUrl.trim() || null,
        release_day: releaseDay === "" ? null : Number(releaseDay),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan komik.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Nama
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Tipe Komik
          <select
            value={typeTag}
            onChange={(e) => setTypeTag(e.target.value as TypeTag)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            {TYPE_TAGS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={isAdult}
            onChange={(e) => setIsAdult(e.target.checked)}
          />
          Konten 18+
        </label>

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

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Link Baca (opsional)
          <input
            type="url"
            value={readUrl}
            onChange={(e) => setReadUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Hari Rilis (opsional)
          <select
            value={releaseDay}
            onChange={(e) => setReleaseDay(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Tidak tentu</option>
            {RELEASE_DAY_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <CoverDropzone
          ref={fileInputRef}
          value={coverUrl}
          onFileSelected={handleFileSelected}
          busy={coverBusy}
          disabled={submitting}
        />

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
            {submitting ? "Menyimpan…" : "Tambah Komik"}
          </button>
        </div>
      </form>

      {pendingCropSrc && (
        <ImageCropModal
          imageSrc={pendingCropSrc}
          onCancel={() => {
            setPendingCropSrc(null);
            setCoverBusy(false);
            // Reset supaya file yang sama bisa dipilih ulang.
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onCropped={(dataUrl) => {
            setCoverUrl(dataUrl);
            setPendingCropSrc(null);
            setCoverBusy(false);
          }}
        />
      )}
    </>
  );
}
