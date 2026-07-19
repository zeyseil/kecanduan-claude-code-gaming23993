import type { Comic } from "../types/comic";
import { summarizeComics } from "../lib/comicStats";

const TYPE_LABEL: Record<Comic["type_tag"], string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface StatsPanelProps {
  comics: Comic[];
  variant: "sidebar" | "compact";
}

export function StatsPanel({ comics, variant }: StatsPanelProps) {
  if (comics.length === 0) return null;
  const stats = summarizeComics(comics);

  const tiles = [
    { label: "Total Komik", value: stats.total },
    { label: "Berjalan", value: stats.ongoing },
    { label: "Tamat", value: stats.completed },
    { label: "Total Chapter", value: stats.totalChapters },
  ];

  if (variant === "compact") {
    return (
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
          >
            <p className="text-lg font-bold text-slate-100">{tile.value}</p>
            <p className="text-xs text-slate-400">{tile.label}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Statistik</h3>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dt className="text-xs text-slate-400">{tile.label}</dt>
            <dd className="text-lg font-bold text-slate-100">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
        {(Object.keys(TYPE_LABEL) as Comic["type_tag"][]).map((type) => (
          <div key={type} className="flex items-center justify-between text-xs text-slate-400">
            <span>{TYPE_LABEL[type]}</span>
            <span className="font-mono text-slate-300">{stats.byType[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
