import type { Comic } from "../types/comic";
import { ComicCard } from "./ComicCard";

interface ComicGridProps {
  comics: Comic[];
  pressedComicId: string | null;
  onPress: (comicId: string) => void;
  onEdit: (comic: Comic) => void;
}

export function ComicGrid({ comics, pressedComicId, onPress, onEdit }: ComicGridProps) {
  if (comics.length === 0) {
    return (
      <p className="py-12 text-center text-slate-400">
        Tidak ada komik yang cocok.
      </p>
    );
  }

  return (
    <div className="relative">
      {pressedComicId !== null && (
        <div
          aria-hidden="true"
          onClick={() => onPress(pressedComicId)}
          className="fixed inset-0 z-0"
        />
      )}
      <div className="relative z-[1] grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {comics.map((comic) => (
          <ComicCard
            key={comic.comic_id}
            comic={comic}
            isPressed={comic.comic_id === pressedComicId}
            isDimmed={pressedComicId !== null && comic.comic_id !== pressedComicId}
            onPress={onPress}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}
