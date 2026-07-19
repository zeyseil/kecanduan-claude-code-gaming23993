import type { Status, TypeTag } from "../types/comic";
import { TYPE_TAGS, STATUSES } from "../types/comic";
import type { ComicListOptions, SortKey } from "../lib/comicList";

const SORT_LABEL: Record<SortKey, string> = {
  recent: "Terbaru diupdate",
  alpha: "Judul (A–Z)",
  type: "Jenis",
};

const TYPE_LABEL: Record<TypeTag, string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

const STATUS_LABEL: Record<Status, string> = {
  ongoing: "Berjalan",
  completed: "Tamat",
};

interface ToolbarProps {
  options: ComicListOptions;
  onChange: (next: ComicListOptions) => void;
  onOpenSearch: () => void;
  onExport: () => void;
  /** false kalau tidak ada komik untuk diekspor. */
  canExport: boolean;
  onToggleSelect: () => void;
  selectMode: boolean;
}

export function Toolbar({
  options,
  onChange,
  onOpenSearch,
  onExport,
  canExport,
  onToggleSelect,
  selectMode,
}: ToolbarProps) {
  const set = <K extends keyof ComicListOptions>(
    key: K,
    value: ComicListOptions[K],
  ) => onChange({ ...options, [key]: value });

  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center justify-between gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-400 hover:border-indigo-500 hover:text-slate-200 sm:min-w-[200px]"
      >
        <span>Cari judul…</span>
        <kbd className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-500">
          Ctrl K
        </kbd>
      </button>

      <select
        aria-label="Urutkan"
        value={options.sort}
        onChange={(e) => set("sort", e.target.value as SortKey)}
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
      >
        {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
          <option key={key} value={key}>
            {SORT_LABEL[key]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter jenis"
        value={options.typeFilter}
        onChange={(e) =>
          set("typeFilter", e.target.value as TypeTag | "all")
        }
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
      >
        <option value="all">Semua jenis</option>
        {TYPE_TAGS.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter status"
        value={options.statusFilter}
        onChange={(e) =>
          set("statusFilter", e.target.value as Status | "all")
        }
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
      >
        <option value="all">Semua status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <div className="flex gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={onToggleSelect}
          className={`rounded-md border px-3 py-2 text-sm transition ${
            selectMode
              ? "border-rose-500 bg-rose-950/40 text-rose-200"
              : "border-slate-600 bg-slate-800 text-slate-300 hover:border-rose-500 hover:text-rose-200"
          }`}
        >
          {selectMode ? "Batal pilih" : "Pilih"}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? "Unduh daftar komik sebagai file .md" : "Belum ada komik untuk diekspor"}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:border-indigo-500 hover:text-slate-200 disabled:opacity-50 disabled:hover:border-slate-600 disabled:hover:text-slate-300"
        >
          Export .md
        </button>
      </div>
    </div>
  );
}
