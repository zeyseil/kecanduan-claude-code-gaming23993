import { useState } from "react";
import {
  CHAPTER_SOURCES,
  fetchNextChapterReadUrl,
  type ChapterSourceId,
} from "../lib/api/comics";

interface ChapterSourceModalProps {
  /** Judul dari state form Edit saat itu (belum disimpan) — dipakai sebagai query pencarian DAN ditampilkan sebagai konteks di header panel. */
  title: string;
  /** Chapter terakhir dari state form Edit saat itu (belum disimpan) — pencarian mencari chapter setelah angka ini. */
  afterChapter: number;
  /** Dipanggil dengan read_url hasil pencarian — pemanggil mengisi field-nya sendiri. */
  onResult: (readUrl: string) => void;
  onClose: () => void;
}

/**
 * Panel pemilih layanan untuk "Cari link chapter berikutnya" — muncul di sebelah
 * modal Edit (flanking di layar lebar, menumpuk di layar kecil). User memilih
 * satu layanan; hasilnya diisikan lewat onResult, TIDAK auto-simpan.
 */
export function ChapterSourceModal({
  title,
  afterChapter,
  onResult,
  onClose,
}: ChapterSourceModalProps) {
  const [pending, setPending] = useState<ChapterSourceId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (source: ChapterSourceId) => {
    setError(null);
    setPending(source);
    try {
      const result = await fetchNextChapterReadUrl(title, afterChapter, source);
      if (result.read_url) {
        onResult(result.read_url);
      } else {
        setError(result.reason ?? "Chapter berikutnya tidak ditemukan.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencari link chapter.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="w-full max-w-xs rounded-lg bg-slate-800 p-4 shadow-xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">Pilih layanan</h3>
          <p className="truncate text-xs text-slate-400" title={title}>
            untuk: {title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending !== null}
          className="shrink-0 rounded px-2 py-0.5 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
          aria-label="Tutup"
        >
          ✕
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-rose-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {CHAPTER_SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handlePick(s.id)}
            disabled={pending !== null}
            className="rounded-md border border-slate-600 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {pending === s.id ? `Mencari di ${s.label}…` : s.label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        <strong className="text-slate-400">Batasan fitur ini:</strong> comick.dev &amp; MangaDex
        mencari chapter bahasa Inggris; Shinigami, Komiku, Kiryuu, dan Komikcast (semua ID) bahasa
        Indonesia. Pencarian berdasarkan judul &amp; chapter yang sedang diisi di form Edit saat ini
        (tidak perlu Simpan dulu). MangaDex sering tidak punya chapter untuk judul populer yang
        sudah berlisensi resmi — coba comick.dev atau sumber ID. Komiku butuh instance yang
        di-deploy sendiri (KOMIKU_API_URL) — bisa tidak tersedia kalau belum dikonfigurasi. Kiryuu
        dibaca langsung dari halaman situsnya (bukan API resmi) sehingga paling rentan berhenti
        bekerja kalau situsnya berganti tampilan. <strong className="text-slate-400">Komikcast
        eksperimental</strong> — lewat browser headless untuk melewati proteksi bot situsnya,
        jadi bisa lebih lambat, dan bisa gagal total kalau kuota harian habis atau proteksi bot
        tetap menolak. Tiap sumber hanya menemukan judul yang ADA di katalognya; katalog sangat
        panjang mungkin tidak ketemu — isi manual kalau begitu.
      </p>
    </div>
  );
}
