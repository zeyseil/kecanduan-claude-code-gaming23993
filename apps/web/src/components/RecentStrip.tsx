import type { Comic } from "../types/comic";
import { ComicCard } from "./ComicCard";
import { SectionHeader } from "./SectionHeader";

interface RecentStripProps {
  comics: Comic[];
  /** Mode Aman aktif — cover 18+ disensor (tanpa tombol buka di strip ini). */
  safeMode?: boolean;
  revealedIds?: Set<string>;
}

export function RecentStrip({ comics, safeMode = false, revealedIds }: RecentStripProps) {
  if (comics.length === 0) return null;

  return (
    <section className="mb-6" aria-label="Komik terbaru">
      <SectionHeader title="Terbaru" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {comics.map((comic) => (
          <div key={comic.comic_id} className="w-32 shrink-0">
            <ComicCard
              comic={comic}
              blurred={safeMode && !(revealedIds?.has(comic.comic_id) ?? false)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
