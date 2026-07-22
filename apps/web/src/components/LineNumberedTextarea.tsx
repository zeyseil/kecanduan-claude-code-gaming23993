import { useMemo, useRef } from "react";

interface LineNumberedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  /** Kelas tinggi textarea+gutter (mis. "max-h-[60vh] min-h-[40vh]") — beda pemakai butuh tinggi beda. */
  heightClassName: string;
}

/** Textarea kode dengan gutter nomor baris tersinkron scroll — dipakai TextEditor (Tulis bebas) dan BulkImportPanel (Import historis). */
export function LineNumberedTextarea({
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  heightClassName,
}: LineNumberedTextareaProps) {
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => Math.max(value.split("\n").length, 1), [value]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1),
    [lineCount],
  );

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className={`${heightClassName} select-none overflow-hidden bg-slate-800 px-2 py-3 text-right font-mono text-sm leading-6 text-slate-600`}
      >
        {lineNumbers.map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <textarea
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder={placeholder}
        disabled={disabled}
        className={`${heightClassName} flex-1 resize-none bg-slate-900 px-3 py-3 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60`}
      />
    </div>
  );
}
