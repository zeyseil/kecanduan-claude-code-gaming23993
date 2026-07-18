import { useEffect, useMemo, useState } from "react";
import {
  selectComics,
  selectRecent,
  DEFAULT_OPTIONS,
  type ComicListOptions,
} from "../lib/comicList";
import {
  deleteComic,
  fetchComics,
  patchComic,
  postComic,
  type ComicPatch,
  type NewComicInput,
} from "../lib/api/comics";
import type { Comic } from "../types/comic";
import { Toolbar } from "../components/Toolbar";
import { ComicGrid } from "../components/ComicGrid";
import { RecentStrip } from "../components/RecentStrip";
import { SectionHeader } from "../components/SectionHeader";
import { AddComicForm } from "../components/AddComicForm";
import { EditComicForm } from "../components/EditComicForm";

const RECENT_LIMIT = 8;

type LoadStatus = "loading" | "ready" | "error";

export function DaftarKomik() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<ComicListOptions>(DEFAULT_OPTIONS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingComic, setEditingComic] = useState<Comic | null>(null);
  const [pressedComicId, setPressedComicId] = useState<string | null>(null);

  const loadComics = () => {
    setLoadStatus("loading");
    setLoadError(null);
    fetchComics()
      .then((result) => {
        setComics(result);
        setLoadStatus("ready");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat komik.");
        setLoadStatus("error");
      });
  };

  useEffect(() => {
    loadComics();
  }, []);

  const visible = useMemo(() => selectComics(comics, options), [comics, options]);
  const recent = useMemo(() => selectRecent(comics, RECENT_LIMIT), [comics]);
  const isSearching = options.search.trim() !== "";

  const handleAdd = async (input: NewComicInput) => {
    const created = await postComic(input);
    setComics((prev) => [created, ...prev]);
    setShowAddForm(false);
  };

  const handlePress = (comicId: string) => {
    setPressedComicId((prev) => (prev === comicId ? null : comicId));
  };

  const handleEditOpen = (comic: Comic) => {
    setEditingComic(comic);
    setPressedComicId(null);
  };

  const handleEditSubmit = async (patch: ComicPatch) => {
    if (!editingComic) return;
    const updated = await patchComic(editingComic.comic_id, patch);
    setComics((prev) => prev.map((c) => (c.comic_id === updated.comic_id ? updated : c)));
    setEditingComic(null);
  };

  const handleDelete = async () => {
    if (!editingComic) return;
    await deleteComic(editingComic.comic_id);
    setComics((prev) => prev.filter((c) => c.comic_id !== editingComic.comic_id));
    setEditingComic(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">Daftar Komik</h1>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + Tambah Komik
        </button>
      </div>

      {loadStatus === "loading" && (
        <p className="py-8 text-center text-sm text-slate-400">Memuat komik…</p>
      )}

      {loadStatus === "error" && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-rose-400">{loadError}</p>
          <button
            type="button"
            onClick={loadComics}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-600"
          >
            Coba lagi
          </button>
        </div>
      )}

      {loadStatus === "ready" && (
        <>
          {!isSearching && <RecentStrip comics={recent} />}

          <Toolbar options={options} onChange={setOptions} />
          <SectionHeader title="Semua Komik" count={visible.length} />
          <ComicGrid
            comics={visible}
            pressedComicId={pressedComicId}
            onPress={handlePress}
            onEdit={handleEditOpen}
          />
        </>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-slate-800 p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-100">
              Tambah Komik
            </h2>
            <AddComicForm
              onSubmit={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {editingComic && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-slate-800 p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-100">
              Edit Komik — {editingComic.title}
            </h2>
            <EditComicForm
              comic={editingComic}
              onSubmit={handleEditSubmit}
              onDelete={handleDelete}
              onCancel={() => setEditingComic(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
