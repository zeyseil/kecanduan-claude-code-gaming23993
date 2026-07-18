import type { Comic } from "../types/comic";
import { formatChapter, formatRelativeTime } from "../lib/format";

const TYPE_LABEL: Record<Comic["type_tag"], string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface ComicCardProps {
  comic: Comic;
  /** Kalau tidak diisi, interaksi press/edit disembunyikan (mis. dipakai di RecentStrip). */
  isPressed?: boolean;
  /** true kalau ADA card lain (bukan card ini) yang sedang pressed — dipakai untuk meredupkan card ini. */
  isDimmed?: boolean;
  onPress?: (comicId: string) => void;
  onEdit?: (comic: Comic) => void;
}

export function ComicCard({ comic, isPressed, isDimmed, onPress, onEdit }: ComicCardProps) {
  return (
    <article
      onClick={() => onPress?.(comic.comic_id)}
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-slate-800 shadow transition duration-200 ${
        onPress ? "cursor-pointer" : ""
      } ${isPressed ? "z-10 scale-105 shadow-glow animate-glow-pulse" : ""} ${
        isDimmed ? "pointer-events-none opacity-40 blur-[1px]" : ""
      }`}
    >
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

        {isPressed && onEdit && (
          <button
            type="button"
            aria-label={`Edit ${comic.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(comic);
            }}
            className="absolute bottom-1.5 right-1.5 rounded-full bg-slate-900/80 p-1.5 text-slate-100 shadow hover:bg-slate-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.507l-3.06.874a.5.5 0 0 1-.618-.618l.874-3.06a2 2 0 0 1 .507-.878l8.5-8.5a2 2 0 0 1 0 0Z" />
            </svg>
          </button>
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
