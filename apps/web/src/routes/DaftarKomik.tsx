import { useMemo, useState } from "react";
import { MOCK_COMICS } from "../mocks/comics";
import {
  selectComics,
  selectRecent,
  DEFAULT_OPTIONS,
  type ComicListOptions,
} from "../lib/comicList";
import { createComic, type NewComicInput } from "../lib/createComic";
import type { Comic } from "../types/comic";
import { Toolbar } from "../components/Toolbar";
import { ComicGrid } from "../components/ComicGrid";
import { RecentStrip } from "../components/RecentStrip";
import { SectionHeader } from "../components/SectionHeader";
import { AddComicForm } from "../components/AddComicForm";

const RECENT_LIMIT = 8;

export function DaftarKomik() {
  const [comics, setComics] = useState<Comic[]>(MOCK_COMICS);
  const [options, setOptions] = useState<ComicListOptions>(DEFAULT_OPTIONS);
  const [showAddForm, setShowAddForm] = useState(false);

  const visible = useMemo(() => selectComics(comics, options), [comics, options]);
  const recent = useMemo(() => selectRecent(comics, RECENT_LIMIT), [comics]);
  const isSearching = options.search.trim() !== "";

  const handleAdd = (input: NewComicInput) => {
    setComics((prev) => [createComic(input), ...prev]);
    setShowAddForm(false);
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

      {!isSearching && <RecentStrip comics={recent} />}

      <Toolbar options={options} onChange={setOptions} />
      <SectionHeader title="Semua Komik" count={visible.length} />
      <ComicGrid comics={visible} />

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
    </div>
  );
}
