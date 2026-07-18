import type { Comic } from "../types/comic";
import { ComicCard } from "./ComicCard";

interface ComicGridProps {
  comics: Comic[];
  onUpdateChapter: (comic: Comic) => void;
}

export function ComicGrid({ comics, onUpdateChapter }: ComicGridProps) {
  if (comics.length === 0) {
    return (
      <p className="py-12 text-center text-slate-400">
        Tidak ada komik yang cocok.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {comics.map((comic) => (
        <ComicCard key={comic.comic_id} comic={comic} onUpdateChapter={onUpdateChapter} />
      ))}
    </div>
  );
}
