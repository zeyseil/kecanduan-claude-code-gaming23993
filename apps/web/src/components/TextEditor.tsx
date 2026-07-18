import { useMemo, useRef, useState } from "react";

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
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => Math.max(text.split("\n").length, 1), [text]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleProcess = () => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    onProcess?.(trimmed);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="max-h-[60vh] select-none overflow-hidden bg-slate-800 px-2 py-3 text-right font-mono text-sm leading-6 text-slate-500"
        >
          {lineNumbers.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          aria-label="Editor catatan komik"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="max-h-[60vh] min-h-[40vh] flex-1 resize-none bg-slate-900 px-3 py-3 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
      </div>

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
