import type { Comic } from "../types/comic";
import { ComicCard } from "./ComicCard";

interface ComicGridProps {
  comics: Comic[];
  pressedComicId: string | null;
  onPress: (comicId: string) => void;
  onEdit: (comic: Comic) => void;
  /** Mode bulk-delete: klik card = pilih, bukan press-to-reveal. */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (comicId: string) => void;
  onToggleStatus?: (comic: Comic) => void;
  /** Mode Aman aktif — cover 18+ disensor kecuali id-nya ada di revealedIds. */
  safeMode?: boolean;
  revealedIds?: Set<string>;
  onReveal?: (comic: Comic) => void;
}

export function ComicGrid({
  comics,
  pressedComicId,
  onPress,
  onEdit,
  selectMode = false,
  selectedIds,
  onToggleSelect,
  onToggleStatus,
  safeMode = false,
  revealedIds,
  onReveal,
}: ComicGridProps) {
  if (comics.length === 0) {
    return (
      <p className="py-12 text-center text-slate-400">
        Tidak ada komik yang cocok.
      </p>
    );
  }

  return (
    <div className="relative" data-testid="comic-grid">
      {/* Backdrop click-catcher hanya untuk press-to-reveal; dimatikan di mode
          pilih supaya klik pertama tidak dimakan backdrop. */}
      {!selectMode && pressedComicId !== null && (
        <div
          aria-hidden="true"
          onClick={() => onPress(pressedComicId)}
          className="fixed inset-0 z-0"
        />
      )}
      <div className="relative z-[1] grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
        {comics.map((comic) => (
          <ComicCard
            key={comic.comic_id}
            comic={comic}
            isPressed={!selectMode && comic.comic_id === pressedComicId}
            isDimmed={!selectMode && pressedComicId !== null && comic.comic_id !== pressedComicId}
            onPress={onPress}
            onEdit={onEdit}
            isSelectable={selectMode}
            isSelected={selectMode && (selectedIds?.has(comic.comic_id) ?? false)}
            onToggleSelect={onToggleSelect}
            onToggleStatus={selectMode ? undefined : onToggleStatus}
            blurred={safeMode && !(revealedIds?.has(comic.comic_id) ?? false)}
            onReveal={onReveal}
          />
        ))}
      </div>
    </div>
  );
}
