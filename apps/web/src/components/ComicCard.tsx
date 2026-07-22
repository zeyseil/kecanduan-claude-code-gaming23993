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
  /** Mode bulk-delete aktif: klik card = pilih/batal pilih, bukan press-to-reveal. */
  isSelectable?: boolean;
  /** true kalau card ini sedang terpilih untuk dihapus (glow merah). */
  isSelected?: boolean;
  onToggleSelect?: (comicId: string) => void;
  /** Toggle status ongoing/completed 1 klik — tombol muncul di pojok kiri-bawah saat pressed. */
  onToggleStatus?: (comic: Comic) => void;
  /** Mode Aman aktif & cover ini belum dibuka: sensor cover kalau is_adult. */
  blurred?: boolean;
  /** Dipanggil saat user menekan "Tampilkan" pada cover 18+ tersensor. */
  onReveal?: (comic: Comic) => void;
}

export function ComicCard({
  comic,
  isPressed,
  isDimmed,
  onPress,
  onEdit,
  isSelectable,
  isSelected,
  onToggleSelect,
  onToggleStatus,
  blurred,
  onReveal,
}: ComicCardProps) {
  const censored = Boolean(blurred && comic.is_adult);
  const handleClick = () => {
    if (isSelectable) {
      onToggleSelect?.(comic.comic_id);
      return;
    }
    onPress?.(comic.comic_id);
  };

  return (
    <article
      onClick={handleClick}
      aria-pressed={isSelectable ? isSelected : undefined}
      className={`group relative flex flex-col overflow-hidden rounded-lg bg-slate-800 shadow transition duration-200 ${
        onPress || isSelectable ? "cursor-pointer" : ""
      } ${isPressed ? "z-10 scale-105 shadow-glow animate-glow-pulse" : ""} ${
        isSelected ? "z-10 scale-105 shadow-glow-danger animate-glow-pulse-danger" : ""
      } ${isDimmed ? "pointer-events-none opacity-40 blur-[1px]" : ""}`}
    >
      <div className="relative aspect-[3/4] bg-slate-700">
        {comic.cover_url ? (
          <img
            src={comic.cover_url}
            alt={`Cover ${comic.title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover ${censored ? "scale-110 blur-2xl" : ""}`}
          />
        ) : (
          <div
            data-testid="cover-placeholder"
            className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-slate-400"
          >
            Tanpa cover
          </div>
        )}

        {censored && (
          <div
            data-testid="nsfw-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 px-2 text-center"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-300">
              Konten NSFW
            </span>
            {onReveal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReveal(comic);
                }}
                className="rounded-md bg-rose-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500"
              >
                Tampilkan
              </button>
            )}
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

        {isSelectable && isSelected && (
          <span
            aria-label="Terpilih untuk dihapus"
            className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-white shadow"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.6a1 1 0 0 1-1.42.004l-3.5-3.5a1 1 0 1 1 1.414-1.414l2.79 2.79 6.796-6.888a1 1 0 0 1 1.414-.006Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}

        {isPressed && onToggleStatus && (
          <button
            type="button"
            aria-label={
              comic.status === "completed"
                ? `Tandai ${comic.title} sebagai ongoing`
                : `Tandai ${comic.title} sebagai tamat`
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(comic);
            }}
            className="absolute bottom-1.5 left-1.5 rounded-full bg-slate-900/80 p-1.5 text-slate-100 shadow hover:bg-slate-900"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
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
        {comic.note && (
          <p className="truncate text-[11px] italic text-amber-300/80" title={comic.note}>
            {comic.note}
          </p>
        )}
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
