const RAW_EXAMPLE = "162. Judul komik(manga) : ch11\n172.Judul lain(2022)(manhwa):ch32";

interface ImportFormatPickerProps {
  onInsertExample: (text: string) => void;
}

/** Kartu format contoh. Hanya "Default (RAW)" yang fungsional — parser saat ini
 * cuma mengerti format baris-bernomor, belum ada dukungan JSON MangaDex/MAL. */
export function ImportFormatPicker({ onInsertExample }: ImportFormatPickerProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 shadow-lg shadow-black/20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Pilih Format Contoh
      </p>
      <button
        type="button"
        onClick={() => onInsertExample(RAW_EXAMPLE)}
        className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      >
        Default (RAW)
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Format lain (mis. JSON MangaDex/MyAnimeList) belum didukung parser.
      </p>
    </div>
  );
}
