import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import { patchComic } from "../lib/api/comics";
import { setAuthToken } from "../lib/storage";
import { formatChapter } from "../lib/format";
import { ChapterUpdateForm } from "../components/ChapterUpdateForm";
import {
  COMIC_UPDATED_EVENT,
  FLOATING_READER_SET_COMIC_EVENT,
  type FloatingReaderComicPayload,
} from "../lib/floatingReader";

/**
 * Konten window companion always-on-top (Tauri only) yang dibuka lewat
 * openOrFocusFloatingReader() saat klik "Lanjutkan Membaca" di HeroBanner.
 * Window ITU SENDIRI sudah jadi "dialog" — tidak ada modal/backdrop di sini.
 *
 * Judul+chapter dibaca langsung dari query string (dikirim oleh
 * openOrFocusFloatingReader) — TIDAK fetchComics() di sini, supaya window
 * render seketika tanpa menunggu round-trip ke Worker (dulu terasa lambat
 * karena narik seluruh daftar komik hanya untuk cari satu comic_id).
 */
export function FloatingReader() {
  const [searchParams] = useSearchParams();
  const [comic, setComic] = useState<FloatingReaderComicPayload>(() => ({
    comicId: searchParams.get("comicId") ?? "",
    title: searchParams.get("title") ?? "",
    latestChapter: Number(searchParams.get("latestChapter") ?? 0),
  }));
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Fallback kalau localStorage ternyata tidak dibagi antar window Tauri —
  // token dari query string dipakai untuk mengisi localStorage window ini juga.
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) setAuthToken(token);
  }, [searchParams]);

  useEffect(() => {
    const unlisten = listen<FloatingReaderComicPayload>(FLOATING_READER_SET_COMIC_EVENT, (event) => {
      setComic(event.payload);
      setShowUpdateForm(false);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleBackToApp = async () => {
    const main = await WebviewWindow.getByLabel("main");
    await main?.show();
    await main?.setFocus();
  };

  const handleUpdate = async (latestChapter: number) => {
    const updated = await patchComic(comic.comicId, { latest_chapter: latestChapter });
    await emit(COMIC_UPDATED_EVENT, updated);
    setComic({ comicId: updated.comic_id, title: updated.title, latestChapter: updated.latest_chapter });
    setShowUpdateForm(false);
  };

  if (!comic.comicId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-3 text-center text-sm text-rose-400">
        Data komik tidak lengkap.
      </div>
    );
  }

  if (showUpdateForm) {
    return (
      <div className="flex h-screen flex-col overflow-y-auto bg-slate-900 p-3 text-slate-100">
        <ChapterUpdateForm
          comic={{ title: comic.title, latest_chapter: comic.latestChapter }}
          onUpdate={handleUpdate}
          onDismiss={() => setShowUpdateForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col justify-between bg-slate-900 p-3 text-slate-100">
      <div>
        <p className="line-clamp-2 text-sm font-semibold" title={comic.title}>
          {comic.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">Chapter {formatChapter(comic.latestChapter)}</p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowUpdateForm(true)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Update Chapter
        </button>
        <BackButton onClick={handleBackToApp} />
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
    >
      Kembali ke App
    </button>
  );
}
