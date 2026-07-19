import type { Comic } from "../types/comic";
import { selectRecent } from "../lib/comicList";
import { formatChapter, formatRelativeTime } from "../lib/format";

const ACTIVITY_LIMIT = 5;

interface ActivityPanelProps {
  comics: Comic[];
  onEdit: (comic: Comic) => void;
}

export function ActivityPanel({ comics, onEdit }: ActivityPanelProps) {
  if (comics.length === 0) return null;
  const recent = selectRecent(comics, ACTIVITY_LIMIT);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Aktivitas Terakhir</h3>
      <ul className="space-y-1">
        {recent.map((comic) => (
          <li key={comic.comic_id}>
            <button
              type="button"
              onClick={() => onEdit(comic)}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-slate-800"
            >
              <span className="line-clamp-1 text-sm text-slate-200">{comic.title}</span>
              <span className="flex w-full items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-indigo-300">
                  Ch {formatChapter(comic.latest_chapter)}
                </span>
                <span>{formatRelativeTime(comic.updated_at)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
