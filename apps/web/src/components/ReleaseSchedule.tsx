import type { Comic } from "../types/comic";
import { RELEASE_DAY_LABELS } from "../types/comic";

interface ReleaseScheduleProps {
  comics: Comic[];
  onEdit: (comic: Comic) => void;
}

export function ReleaseSchedule({ comics, onEdit }: ReleaseScheduleProps) {
  if (comics.length === 0) return null;
  const today = new Date().getDay();

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Jadwal Rilis</h3>
      <ul className="space-y-1">
        {RELEASE_DAY_LABELS.map((label, day) => {
          const comicsOnDay = comics.filter((c) => c.release_day === day);
          return (
            <li
              key={label}
              className={`rounded-md px-2 py-1.5 ${day === today ? "bg-indigo-950/40" : ""}`}
            >
              <div className="flex items-center justify-between text-xs">
                <span
                  className={day === today ? "font-semibold text-indigo-300" : "text-slate-400"}
                >
                  {label}
                </span>
              </div>
              {comicsOnDay.length === 0 ? (
                <p className="text-xs text-slate-600">—</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {comicsOnDay.map((comic) => (
                    <li key={comic.comic_id}>
                      <button
                        type="button"
                        onClick={() => onEdit(comic)}
                        className="line-clamp-1 text-left text-sm text-slate-200 hover:text-indigo-300"
                      >
                        {comic.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-500">
        <strong className="text-slate-400">Batasan fitur ini:</strong> hari rilis diisi manual
        per komik lewat form Edit — tidak diverifikasi atau disinkronkan ke sumber manapun.
        Kalau komik yang Anda baca ganti jadwal rilis, Anda perlu mengubahnya sendiri di sini.
      </p>
    </div>
  );
}
