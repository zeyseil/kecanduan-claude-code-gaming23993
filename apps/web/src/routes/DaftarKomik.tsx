import { useEffect, useMemo, useState } from "react";
import {
  selectComics,
  selectRecent,
  paginate,
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
import { chunk } from "../lib/chunk";
import { ProgressBar } from "../components/ProgressBar";
import { Toolbar } from "../components/Toolbar";
import { ComicGrid } from "../components/ComicGrid";
import { RecentStrip } from "../components/RecentStrip";
import { SectionHeader } from "../components/SectionHeader";
import { AddComicForm } from "../components/AddComicForm";
import { EditComicForm } from "../components/EditComicForm";
import { SearchPalette } from "../components/SearchPalette";
import { BulkDeleteConfirm } from "../components/BulkDeleteConfirm";
import { NsfwRevealConfirm } from "../components/NsfwRevealConfirm";
import { getSafeMode, setSafeMode } from "../lib/storage";
import { HeroBanner } from "../components/HeroBanner";
import { StatsPanel } from "../components/StatsPanel";
import { ActivityPanel } from "../components/ActivityPanel";
import { ReleaseSchedule } from "../components/ReleaseSchedule";
import { SkeletonGrid, SkeletonHero, SkeletonPanel } from "../components/Skeletons";
import { Pagination } from "../components/Pagination";
import { ContinueReadingPrompt } from "../components/ContinueReadingPrompt";
import { takeReadingSession } from "../lib/readingSession";
import { readComicCache, writeComicCache } from "../lib/comicCache";
import { launchReading } from "../lib/openReading";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { COMIC_UPDATED_EVENT } from "../lib/floatingReader";

const RECENT_LIMIT = 8;
// Server membatasi 25 comic per request bulk-delete (MAX_BULK_DELETE). Client
// memecah pilihan sebesar apa pun jadi batch ini dan mengirim berurutan, dengan
// jeda kecil antar-batch supaya tidak menabrak rate-limit per-user Worker.
const BULK_DELETE_CHUNK = 25;
const BULK_DELETE_GAP_MS = 150;

type LoadStatus = "loading" | "ready" | "error";

export function DaftarKomik() {
  // Stale-while-revalidate: mulai dari cache localStorage kalau ada — data
  // langsung tampil (tanpa skeleton), lalu fetch di useEffect menggantikannya.
  const [comics, setComics] = useState<Comic[]>(() => readComicCache() ?? []);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(() =>
    readComicCache() ? "ready" : "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<ComicListOptions>(DEFAULT_OPTIONS);
  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingComic, setEditingComic] = useState<Comic | null>(null);
  const [pressedComicId, setPressedComicId] = useState<string | null>(null);
  const [showSearchPalette, setShowSearchPalette] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);
  const [resumeComic, setResumeComic] = useState<Comic | null>(null);
  const [safeMode, setSafeModeState] = useState(() => getSafeMode());
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [revealComic, setRevealComic] = useState<Comic | null>(null);

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

  // Jalur non-Tauri: prompt update chapter muncul saat tab kembali visible.
  // Di Tauri, FloatingReader (window companion always-on-top) menggantikan
  // peran ini — mendaftarkan listener ini juga di Tauri akan memicu prompt
  // dobel begitu user akhirnya kembali fokus ke window utama.
  useEffect(() => {
    if (isTauri()) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const comicId = takeReadingSession();
      if (!comicId) return;
      setComics((prev) => {
        const comic = prev.find((c) => c.comic_id === comicId);
        if (comic) setResumeComic(comic);
        return prev;
      });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Tauri only: FloatingReader (window companion) meng-emit event ini setelah
  // berhasil update chapter dari luar window utama — merge ke state lokal
  // tanpa refetch penuh, sama seperti alur handleEditSubmit.
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen<Comic>(COMIC_UPDATED_EVENT, (event) => {
      setComics((prev) => prev.map((c) => (c.comic_id === event.payload.comic_id ? event.payload : c)));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const loadComics = (background = false) => {
    // Refresh background (ada data cache yang sudah tampil): jangan tampilkan
    // skeleton, dan kalau gagal biarkan data cache tetap tampil (silent).
    if (!background) {
      setLoadStatus("loading");
      setLoadError(null);
    }
    fetchComics()
      .then((result) => {
        setComics(result);
        setLoadStatus("ready");
      })
      .catch((err: unknown) => {
        if (background) return;
        setLoadError(err instanceof Error ? err.message : "Gagal memuat komik.");
        setLoadStatus("error");
      });
  };

  useEffect(() => {
    loadComics(readComicCache() !== null);
  }, []);

  // Satu titik tulis cache untuk semua mutasi (add/edit/delete/bulk/toggle) —
  // hanya saat ready supaya state awal kosong tidak menimpa cache yang ada.
  useEffect(() => {
    if (loadStatus === "ready") writeComicCache(comics);
  }, [comics, loadStatus]);

  const visible = useMemo(() => selectComics(comics, options), [comics, options]);
  const recent = useMemo(() => selectRecent(comics, RECENT_LIMIT), [comics]);
  const isSearching = options.search.trim() !== "";

  // Filter/search/sort baru bisa mempersempit hasil di bawah halaman saat ini —
  // kembali ke halaman 1 supaya tidak menampilkan grid kosong.
  useEffect(() => {
    setPage(0);
  }, [options]);

  const { items: pageItems, totalPages } = useMemo(() => paginate(visible, page), [visible, page]);

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

  const handleToggleStatus = async (comic: Comic) => {
    const next = comic.status === "completed" ? "ongoing" : "completed";
    const updated = await patchComic(comic.comic_id, { status: next });
    setComics((prev) => prev.map((c) => (c.comic_id === updated.comic_id ? updated : c)));
  };

  const handleResumeUpdate = async (latestChapter: number) => {
    if (!resumeComic) return;
    const updated = await patchComic(resumeComic.comic_id, { latest_chapter: latestChapter });
    setComics((prev) => prev.map((c) => (c.comic_id === updated.comic_id ? updated : c)));
    setResumeComic(null);
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

  const handleToggleSafeMode = () => {
    setSafeModeState((prev) => {
      const next = !prev;
      setSafeMode(next);
      // Menyalakan lagi Mode Aman menutup ulang semua yang tadi dibuka.
      if (next) setRevealedIds(new Set());
      return next;
    });
  };

  const handleRevealConfirm = () => {
    if (!revealComic) return;
    setRevealedIds((prev) => new Set(prev).add(revealComic.comic_id));
    setRevealComic(null);
  };

  const selectedComics = comics.filter((c) => selectedIds.has(c.comic_id));

  const handleBulkDelete = async () => {
    const ids = selectedComics.map((c) => c.comic_id);
    // Batch ≤25/request supaya pilihan sebesar apa pun tidak perlu diulang.
    const batches = chunk(ids, BULK_DELETE_CHUNK);
    const removed = new Set<string>();
    setShowBulkConfirm(false);
    setDeleteProgress({ done: 0, total: ids.length });
    try {
      for (const batch of batches) {
        const results = await bulkDeleteComics(batch);
        for (const r of results) if (r.deleted) removed.add(r.comic_id);
        // Id yang server balas "sudah tidak ada" tetap dibuang dari grid.
        for (const id of batch) removed.add(id);
        setDeleteProgress((prev) => ({
          total: ids.length,
          done: (prev?.done ?? 0) + batch.length,
        }));
        if (batch !== batches[batches.length - 1]) {
          await new Promise((resolve) => setTimeout(resolve, BULK_DELETE_GAP_MS));
        }
      }
    } finally {
      setComics((prev) => prev.filter((c) => !removed.has(c.comic_id)));
      setDeleteProgress(null);
      exitSelectMode();
    }
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
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
          <div>
            <SkeletonHero />
            <SkeletonGrid />
          </div>
          <aside className="hidden lg:flex lg:flex-col lg:gap-4">
            <SkeletonPanel />
            <SkeletonPanel />
            <SkeletonPanel />
          </aside>
        </div>
      )}

      {loadStatus === "error" && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-rose-400">{loadError}</p>
          <button
            type="button"
            onClick={() => loadComics()}
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
              safeMode={safeMode}
              onToggleSafeMode={handleToggleSafeMode}
            />

            <HeroBanner
              comics={comics}
              onEdit={handleEditOpen}
              safeMode={safeMode}
              revealedIds={revealedIds}
            />

            <div className="lg:hidden">
              <StatsPanel comics={comics} variant="compact" />
            </div>

            {!isSearching && (
              <RecentStrip comics={recent} safeMode={safeMode} revealedIds={revealedIds} />
            )}

            <SectionHeader title="Semua Komik" count={visible.length} />
            <ComicGrid
              comics={pageItems}
              pressedComicId={pressedComicId}
              onPress={handlePress}
              onEdit={handleEditOpen}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleStatus={handleToggleStatus}
              onRead={launchReading}
              safeMode={safeMode}
              revealedIds={revealedIds}
              onReveal={setRevealComic}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>

          <aside className="hidden lg:flex lg:flex-col lg:gap-4">
            <StatsPanel comics={comics} variant="sidebar" />
            <ActivityPanel comics={comics} onEdit={handleEditOpen} />
            <ReleaseSchedule comics={comics} onEdit={handleEditOpen} />
          </aside>
        </div>
      )}

      {selectMode && (
        <div className="sticky bottom-0 z-10 mt-4 flex flex-col gap-2 border-t border-slate-700 bg-slate-900/95 px-2 py-3 backdrop-blur">
          {deleteProgress ? (
            <ProgressBar done={deleteProgress.done} total={deleteProgress.total} label="Menghapus komik" />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
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
        </div>
      )}

      {resumeComic && (
        <ContinueReadingPrompt
          comic={resumeComic}
          onUpdate={handleResumeUpdate}
          onDismiss={() => setResumeComic(null)}
        />
      )}

      {revealComic && (
        <NsfwRevealConfirm
          comic={revealComic}
          onConfirm={handleRevealConfirm}
          onCancel={() => setRevealComic(null)}
        />
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
