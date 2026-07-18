import { useMemo, useState } from "react";
import type { Comic } from "../types/comic";
import { selectComics, DEFAULT_OPTIONS } from "../lib/comicList";
import { formatChapter } from "../lib/format";

interface SearchPaletteProps {
  comics: Comic[];
  onSelect: (comic: Comic) => void;
  onClose: () => void;
}

export function SearchPalette({ comics, onSelect, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => selectComics(comics, { ...DEFAULT_OPTIONS, search: query }),
    [comics, query],
  );

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/70 p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Cari komik"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-lg bg-slate-800 shadow-xl"
      >
        <input
          autoFocus
          type="text"
          aria-label="Cari judul komik"
          placeholder="Cari judul komik…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          className="w-full border-b border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />

        <ul className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              {query.trim() === "" ? "Ketik untuk mencari komik…" : "Tidak ada komik yang cocok."}
            </li>
          )}
          {results.map((comic) => (
            <li key={comic.comic_id}>
              <button
                type="button"
                onClick={() => onSelect(comic)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-700"
              >
                <div className="h-10 w-8 shrink-0 overflow-hidden rounded bg-slate-700">
                  {comic.cover_url && (
                    <img
                      src={comic.cover_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <span className="flex-1 truncate text-sm text-slate-100">{comic.title}</span>
                <span className="shrink-0 font-mono text-xs text-indigo-300">
                  Ch {formatChapter(comic.latest_chapter)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
