import { useEffect, useMemo, useState } from "react";
import {
  selectComics,
  selectRecent,
  DEFAULT_OPTIONS,
  type ComicListOptions,
} from "../lib/comicList";
import {
  bulkDeleteComics,
  deleteComic,
  fetchComics,
  patchComic,
  postComic,
  type ComicPatch,
  type NewComicInput,
} from "../lib/api/comics";
import type { Comic } from "../types/comic";
import { downloadMarkdown } from "../lib/exportMarkdown";
import { Toolbar } from "../components/Toolbar";
import { ComicGrid } from "../components/ComicGrid";
import { RecentStrip } from "../components/RecentStrip";
import { SectionHeader } from "../components/SectionHeader";
import { AddComicForm } from "../components/AddComicForm";
import { EditComicForm } from "../components/EditComicForm";
import { SearchPalette } from "../components/SearchPalette";
import { BulkDeleteConfirm } from "../components/BulkDeleteConfirm";
import { HeroBanner } from "../components/HeroBanner";
import { StatsPanel } from "../components/StatsPanel";
import { ActivityPanel } from "../components/ActivityPanel";
import { ReleaseSchedule } from "../components/ReleaseSchedule";

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
  const [showSearchPalette, setShowSearchPalette] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchPalette(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const enterSelectMode = () => {
    // Mode pilih & press-to-reveal saling eksklusif.
    setPressedComicId(null);
    setSelectMode(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkConfirm(false);
  };

  const handleToggleSelect = (comicId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(comicId)) next.delete(comicId);
      else next.add(comicId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(visible.map((c) => c.comic_id)));
  };

  const selectedComics = comics.filter((c) => selectedIds.has(c.comic_id));

  const handleBulkDelete = async () => {
    const ids = selectedComics.map((c) => c.comic_id);
    const results = await bulkDeleteComics(ids);
    const removed = new Set(results.filter((r) => r.deleted).map((r) => r.comic_id));
    // Buang juga id yang server balas "sudah tidak ada" — tetap hilang dari grid.
    for (const id of ids) removed.add(id);
    setComics((prev) => prev.filter((c) => !removed.has(c.comic_id)));
    exitSelectMode();
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
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
          <div>
            <Toolbar
              options={options}
              onChange={setOptions}
              onOpenSearch={() => setShowSearchPalette(true)}
              onExport={() => downloadMarkdown(comics)}
              canExport={comics.length > 0}
              onToggleSelect={selectMode ? exitSelectMode : enterSelectMode}
              selectMode={selectMode}
            />

            <HeroBanner comics={comics} onEdit={handleEditOpen} />

            <div className="lg:hidden">
              <StatsPanel comics={comics} variant="compact" />
            </div>

            {!isSearching && <RecentStrip comics={recent} />}

            <SectionHeader title="Semua Komik" count={visible.length} />
            <ComicGrid
              comics={visible}
              pressedComicId={pressedComicId}
              onPress={handlePress}
              onEdit={handleEditOpen}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
          </div>

          <aside className="hidden lg:flex lg:flex-col lg:gap-4">
            <StatsPanel comics={comics} variant="sidebar" />
            <ActivityPanel comics={comics} onEdit={handleEditOpen} />
            <ReleaseSchedule comics={comics} onEdit={handleEditOpen} />
          </aside>
        </div>
      )}

      {selectMode && (
        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 border-t border-slate-700 bg-slate-900/95 px-2 py-3 backdrop-blur">
          <span className="text-sm text-slate-300">{selectedIds.size} dipilih</span>
          <button
            type="button"
            onClick={handleSelectAll}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Pilih semua
          </button>
          <button
            type="button"
            onClick={exitSelectMode}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => setShowBulkConfirm(true)}
            disabled={selectedIds.size === 0}
            className="ml-auto rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Hapus {selectedIds.size} komik
          </button>
        </div>
      )}

      {showBulkConfirm && (
        <BulkDeleteConfirm
          comics={selectedComics}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkConfirm(false)}
        />
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

      {showSearchPalette && (
        <SearchPalette
          comics={comics}
          onSelect={(comic) => {
            setShowSearchPalette(false);
            handleEditOpen(comic);
          }}
          onClose={() => setShowSearchPalette(false)}
        />
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
