import type { Comic } from "../types/comic";
import { selectRecent } from "../lib/comicList";
import { formatChapter } from "../lib/format";

const TYPE_LABEL: Record<Comic["type_tag"], string> = {
  manga: "Manga",
  manhwa: "Manhwa",
  manhua: "Manhua",
};

interface HeroBannerProps {
  comics: Comic[];
  onEdit: (comic: Comic) => void;
}

export function HeroBanner({ comics, onEdit }: HeroBannerProps) {
  const [latest] = selectRecent(comics, 1);
  if (!latest) return null;

  return (
    <section className="relative mb-6 overflow-hidden rounded-xl border border-slate-800">
      <div className="absolute inset-0">
        {latest.cover_url && (
          <img
            src={latest.cover_url}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="h-full w-full scale-110 object-cover blur-sm"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
      </div>

      <div className="relative flex flex-col gap-2 px-5 py-6 sm:px-8 sm:py-8">
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
          {TYPE_LABEL[latest.type_tag]} · Terakhir diupdate
        </span>
        <h2 className="max-w-lg text-xl font-bold text-white sm:text-2xl">{latest.title}</h2>
        <p className="text-sm text-slate-300">Chapter {formatChapter(latest.latest_chapter)}</p>

        {latest.read_url ? (
          <a
            href={latest.read_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Lanjutkan Membaca (Ch {formatChapter(latest.latest_chapter)})
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(latest)}
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-indigo-400 hover:text-indigo-200"
          >
            Tambahkan link baca
          </button>
        )}
      </div>
    </section>
  );
}
