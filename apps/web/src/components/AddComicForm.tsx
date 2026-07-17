import { useRef, useState } from "react";
import type { TypeTag } from "../types/comic";
import { TYPE_TAGS } from "../types/comic";
import type { NewComicInput } from "../lib/createComic";
import { readFileAsDataUrl } from "../lib/cropImage";
import { ImageCropModal } from "./ImageCropModal";

const TYPE_LABEL: Record<TypeTag, string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface AddComicFormProps {
  onSubmit: (input: NewComicInput) => void;
  onCancel: () => void;
}

export function AddComicForm({ onSubmit, onCancel }: AddComicFormProps) {
  const [title, setTitle] = useState("");
  const [typeTag, setTypeTag] = useState<TypeTag>("manga");
  const [isAdult, setIsAdult] = useState(false);
  const [chapter, setChapter] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [pendingCropSrc, setPendingCropSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPendingCropSrc(dataUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    onSubmit({
      title: trimmedTitle,
      type_tag: typeTag,
      is_adult: isAdult,
      latest_chapter: chapterValue,
      cover_url: coverUrl,
    });
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
          Cover Image
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm text-slate-400"
          />
        </label>

        {coverUrl && (
          <img
            src={coverUrl}
            alt="Preview cover"
            className="h-32 w-24 rounded-md object-cover"
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Tambah Komik
          </button>
        </div>
      </form>

      {pendingCropSrc && (
        <ImageCropModal
          imageSrc={pendingCropSrc}
          onCancel={() => {
            setPendingCropSrc(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onCropped={(dataUrl) => {
            setCoverUrl(dataUrl);
            setPendingCropSrc(null);
          }}
        />
      )}
    </>
  );
}
