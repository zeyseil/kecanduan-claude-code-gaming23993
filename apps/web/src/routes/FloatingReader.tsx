import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import type { Comic } from "../types/comic";
import { fetchComics, patchComic } from "../lib/api/comics";
import { setAuthToken } from "../lib/storage";
import { formatChapter } from "../lib/format";
import { ChapterUpdateForm } from "../components/ChapterUpdateForm";
import { COMIC_UPDATED_EVENT, FLOATING_READER_SET_COMIC_EVENT } from "../lib/floatingReader";

/**
 * Konten window companion always-on-top (Tauri only) yang dibuka lewat
 * openOrFocusFloatingReader() saat klik "Lanjutkan Membaca" di HeroBanner.
 * Window ITU SENDIRI sudah jadi "dialog" — tidak ada modal/backdrop di sini.
 */
export function FloatingReader() {
  const [searchParams] = useSearchParams();
  const [comicId, setComicId] = useState(() => searchParams.get("comicId") ?? "");
  const [comic, setComic] = useState<Comic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Fallback kalau localStorage ternyata tidak dibagi antar window Tauri —
  // token dari query string dipakai untuk mengisi localStorage window ini juga.
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) setAuthToken(token);
  }, [searchParams]);

  useEffect(() => {
    const unlisten = listen<{ comicId: string }>(FLOATING_READER_SET_COMIC_EVENT, (event) => {
      setComicId(event.payload.comicId);
      setShowUpdateForm(false);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!comicId) return;
    let alive = true;
    fetchComics()
      .then((comics) => {
        if (!alive) return;
        setComic(comics.find((c) => c.comic_id === comicId) ?? null);
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : "Gagal memuat data komik.");
      });
    return () => {
      alive = false;
    };
  }, [comicId]);

  const handleBackToApp = async () => {
    const main = await WebviewWindow.getByLabel("main");
    await main?.show();
    await main?.setFocus();
  };

  const handleUpdate = async (latestChapter: number) => {
    const updated = await patchComic(comicId, { latest_chapter: latestChapter });
    await emit(COMIC_UPDATED_EVENT, updated);
    setComic(updated);
    setShowUpdateForm(false);
  };

  if (loadError) {
    return (
      <div className="flex h-screen flex-col justify-between bg-slate-900 p-3 text-slate-100">
        <p className="text-sm text-rose-400">{loadError}</p>
        <BackButton onClick={handleBackToApp} />
      </div>
    );
  }

  if (!comic) {
    return <div className="flex h-screen items-center justify-center bg-slate-900 text-sm text-slate-400">Memuat…</div>;
  }

  if (showUpdateForm) {
    return (
      <div className="flex h-screen flex-col overflow-y-auto bg-slate-900 p-3 text-slate-100">
        <ChapterUpdateForm comic={comic} onUpdate={handleUpdate} onDismiss={() => setShowUpdateForm(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col justify-between bg-slate-900 p-3 text-slate-100">
      <div>
        <p className="line-clamp-2 text-sm font-semibold" title={comic.title}>
          {comic.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">Chapter {formatChapter(comic.latest_chapter)}</p>
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

