import type { Comic } from "../types/comic";
import { ComicCard } from "./ComicCard";
import { SectionHeader } from "./SectionHeader";

interface RecentStripProps {
  comics: Comic[];
}

export function RecentStrip({ comics }: RecentStripProps) {
  if (comics.length === 0) return null;

  return (
    <section className="mb-6" aria-label="Komik terbaru">
      <SectionHeader title="Terbaru" />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {comics.map((comic) => (
          <div key={comic.comic_id} className="w-32 shrink-0">
            <ComicCard comic={comic} />
          </div>
        ))}
      </div>
    </section>
  );
}
