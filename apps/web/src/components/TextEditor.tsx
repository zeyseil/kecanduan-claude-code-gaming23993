import { useState } from "react";
import { LineNumberedTextarea } from "./LineNumberedTextarea";

interface TextEditorProps {
  /** Dipanggil saat tombol Proses ditekan. */
  onProcess?: (text: string) => void;
  /** Nonaktifkan tombol proses (mis. saat request ke AI agent masih berjalan). */
  disabled?: boolean;
}

const PLACEHOLDER = `Contoh format:
162. Judul komik(manga) : ch11
172.Judul lain(2022)(manhwa):ch32

Atau bahasa bebas:
baru baca solo leveling ch179 tamat`;

export function TextEditor({ onProcess, disabled = false }: TextEditorProps) {
  const [text, setText] = useState("");

  const handleProcess = () => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    onProcess?.(trimmed);
  };

  return (
    <div className="flex flex-col gap-3">
      <LineNumberedTextarea
        value={text}
        onChange={setText}
        ariaLabel="Editor catatan komik"
        placeholder={PLACEHOLDER}
        heightClassName="max-h-[60vh] min-h-[40vh]"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleProcess}
          disabled={text.trim() === "" || disabled}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          {disabled ? "Memproses…" : "Proses dengan AI"}
        </button>
      </div>
    </div>
  );
}
