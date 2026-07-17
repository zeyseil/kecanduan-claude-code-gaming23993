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
}

export function Toolbar({ options, onChange }: ToolbarProps) {
  const set = <K extends keyof ComicListOptions>(
    key: K,
    value: ComicListOptions[K],
  ) => onChange({ ...options, [key]: value });

  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <input
        type="search"
        aria-label="Cari judul komik"
        placeholder="Cari judul…"
        value={options.search}
        onChange={(e) => set("search", e.target.value)}
        className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none sm:min-w-[200px]"
      />

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
    </div>
  );
}
