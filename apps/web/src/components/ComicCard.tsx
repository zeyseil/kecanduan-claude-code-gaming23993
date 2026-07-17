import type { Comic } from "../types/comic";
import { formatChapter, formatRelativeTime } from "../lib/format";

const TYPE_LABEL: Record<Comic["type_tag"], string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface ComicCardProps {
  comic: Comic;
}

export function ComicCard({ comic }: ComicCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg bg-slate-800 shadow transition hover:shadow-lg">
      <div className="relative aspect-[3/4] bg-slate-700">
        {comic.cover_url ? (
          <img
            src={comic.cover_url}
            alt={`Cover ${comic.title}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            data-testid="cover-placeholder"
            className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-400"
          >
            Tanpa cover
          </div>
        )}

        {/* Badge di atas cover: jenis + (opsional) 18+ terpisah. */}
        <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
          <span className="rounded bg-indigo-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {TYPE_LABEL[comic.type_tag]}
          </span>
          {comic.is_adult && (
            <span className="rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              18+
            </span>
          )}
        </div>

        {comic.status === "completed" && (
          <span className="absolute right-1.5 top-1.5 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            Tamat
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <h3
          className="line-clamp-2 text-sm font-medium text-slate-100"
          title={comic.title}
        >
          {comic.title}
        </h3>
        <div className="mt-auto flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-indigo-300">
            Ch {formatChapter(comic.latest_chapter)}
          </span>
          <span>{formatRelativeTime(comic.updated_at)}</span>
        </div>
      </div>
    </article>
  );
}
