import { forwardRef, useId, useState } from "react";

interface CoverDropzoneProps {
  /** Cover yang sudah dipilih (data URL) — ditampilkan sebagai preview. */
  value: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
  /** Dikontrol parent: true selagi baca file / crop berjalan. */
  busy?: boolean;
  disabled?: boolean;
}

/**
 * Area upload cover: klik membuka file picker seperti biasa, plus drag-and-drop.
 *
 * Input file-nya tetap `<input type="file">` sungguhan (disembunyikan lewat
 * `sr-only`, bukan `display:none`) dan dibungkus `<label>` — jadi klik, fokus
 * keyboard, dan screen reader tetap jalan tanpa handler tambahan.
 */
export const CoverDropzone = forwardRef<HTMLInputElement, CoverDropzoneProps>(
  function CoverDropzone({ value, onFileSelected, busy = false, disabled = false }, ref) {
    const [isDragging, setIsDragging] = useState(false);
    const [rejected, setRejected] = useState(false);
    const labelId = useId();

    const accept = (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setRejected(true);
        return;
      }
      setRejected(false);
      void onFileSelected(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
      if (disabled || busy) return;
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDrop = (e: React.DragEvent) => {
      if (disabled || busy) return;
      e.preventDefault();
      setIsDragging(false);
      accept(e.dataTransfer.files?.[0]);
    };

    const state = disabled
      ? "cursor-not-allowed border-slate-700 bg-slate-900/30 opacity-60"
      : isDragging
        ? "scale-[1.02] border-indigo-500 bg-indigo-500/10"
        : "border-slate-600 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-900";

    return (
      <div className="flex flex-col gap-1 text-sm text-slate-300">
        <span id={labelId}>Cover Image</span>

        <label
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={[
            "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition duration-200",
            "focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/40",
            disabled ? "" : "cursor-pointer",
            state,
          ].join(" ")}
        >
          <input
            ref={ref}
            type="file"
            accept="image/*"
            aria-labelledby={labelId}
            disabled={disabled || busy}
            onChange={(e) => accept(e.target.files?.[0])}
            className="sr-only"
          />

          {value ? (
            <>
              <img
                src={value}
                alt="Preview cover"
                referrerPolicy="no-referrer"
                className="h-32 w-24 rounded-md object-cover shadow"
              />
              <span className="text-xs text-slate-400">
                Drop file lain untuk mengganti
              </span>
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className={[
                  "h-8 w-8 transition duration-200",
                  isDragging ? "-translate-y-0.5 text-indigo-400" : "text-slate-500",
                ].join(" ")}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16.5V4.5m0 0L7.5 9M12 4.5 16.5 9M4.5 16.5v1.75A2.25 2.25 0 0 0 6.75 20.5h10.5a2.25 2.25 0 0 0 2.25-2.25V16.5"
                />
              </svg>
              <span className="font-medium text-slate-200">
                {isDragging ? "Lepaskan di sini" : "Drop a file"}
              </span>
              <span className="text-xs text-slate-400">
                atau klik untuk memilih · JPG/PNG
              </span>
            </>
          )}

          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-950/80">
              <span
                role="status"
                aria-label="Memproses gambar"
                className="h-7 w-7 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400"
              />
              <span className="animate-pulse text-xs text-slate-300">
                Memproses gambar…
              </span>
            </div>
          )}
        </label>

        {rejected && (
          <p className="text-xs text-rose-400">
            File itu bukan gambar. Pilih JPG atau PNG.
          </p>
        )}
      </div>
    );
  },
);
