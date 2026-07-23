import { useMemo, useState } from "react";
import { parseHistoris, type FailedLine, type ParsedEntry, type ParseResult } from "../lib/parseHistoris";
import { chunk } from "../lib/chunk";
import { logImportEvent } from "../lib/importHistory";
import { LineNumberedTextarea } from "./LineNumberedTextarea";
import { ImportFormatPicker } from "./ImportFormatPicker";
import { ImportHistoryPanel } from "./ImportHistoryPanel";
import {
  backfillCovers,
  bulkImportComics,
  detectTypes,
  type BulkImportResultItem,
  type DetectTypeResultItem,
} from "../lib/api/comics";

// Cloudflare Workers cap subrequests per invocation, so entries/covers/detections
// are sent in small chunks rather than one giant request — see CLAUDE.md.
// COVER/DETECT turun mengikuti batas Worker baru (MAX_COVER_BACKFILL/
// MAX_DETECT_TITLES di routes/comics.ts) — tiap judul kini bisa memanggil
// MangaDex DAN AniList.
// COVER/DETECT diselaraskan dengan batas Worker (MAX_COVER_BACKFILL=4,
// MAX_DETECT_TITLES=5) — tiap judul kini bisa memanggil hingga 4 sumber.
const IMPORT_CHUNK_SIZE = 20;
const COVER_CHUNK_SIZE = 4;
const DETECT_CHUNK_SIZE = 5;

type Phase = "editing" | "preview" | "importing" | "done";

export function BulkImportPanel() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  // Parsed entries. type_tag null means "needs auto-detection". Detection
  // mutates these in place (fills type_tag or leaves it null).
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [parsedFailed, setParsedFailed] = useState<FailedLine[]>([]);
  // Alasan deteksi gagal per-entri, di-key by entry.id (bukan judul — judul bisa
  // diedit/duplikat). Ditampilkan inline di baris editable.
  const [detectFailedById, setDetectFailedById] = useState<Record<string, string>>({});
  const [detecting, setDetecting] = useState(false);
  const [rowDetecting, setRowDetecting] = useState<string | null>(null);
  const [detectProgress, setDetectProgress] = useState<{ done: number; total: number } | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResults, setImportResults] = useState<BulkImportResultItem[]>([]);
  const [coverProgress, setCoverProgress] = useState<{ done: number; total: number } | null>(null);
  const [coverDone, setCoverDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validation, setValidation] = useState<ParseResult | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const ready = useMemo(() => entries.filter((e) => e.type_tag !== null), [entries]);
  const needsDetection = useMemo(() => entries.filter((e) => e.type_tag === null), [entries]);

  const handleTextChange = (value: string) => {
    setText(value);
    setValidation(null);
  };

  const handleClearEmptyLines = () => {
    setText((prev) =>
      prev
        .split("\n")
        .filter((line) => line.trim() !== "")
        .join("\n"),
    );
    setValidation(null);
  };

  const handleValidate = () => {
    setValidation(parseHistoris(text));
  };

  const handlePreview = () => {
    const result = parseHistoris(text);
    setEntries(result.ok);
    setParsedFailed(result.failed);
    setDetectFailedById({});
    setPhase("preview");

    if (result.failed.length > 0) {
      const extra = result.failed.length > 1 ? ` (+${result.failed.length - 1} baris lain)` : "";
      logImportEvent({
        status: "error",
        message: `Parsing error baris ${result.failed[0].line}${extra}`,
      });
      setHistoryVersion((v) => v + 1);
    }
  };

  // Update judul satu entri (koreksi nama manual). Judul yang dibetulkan
  // menggantikan judul seutuhnya — dipakai untuk deteksi ulang DAN disimpan
  // sebagai judul komik saat import. Hapus penanda gagal lama supaya user tahu
  // baris ini perlu dideteksi ulang.
  const handleTitleChange = (id: string, value: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, title: value } : e)));
    setDetectFailedById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDetect = async () => {
    setErrorMsg(null);
    setDetecting(true);
    // Simpan pasangan id→judul saat request dimulai (judul bisa sudah diedit).
    const pending = needsDetection.map((e) => ({ id: e.id, title: e.title.trim() }));
    setDetectProgress({ done: 0, total: pending.length });

    try {
      const detected = new Map<string, DetectTypeResultItem>();
      for (const c of chunk(pending, DETECT_CHUNK_SIZE)) {
        const results = await detectTypes(c.map((p) => p.title));
        for (const r of results) detected.set(r.title, r);
        setDetectProgress((prev) => ({ ...(prev ?? { done: 0, total: pending.length }), done: (prev?.done ?? 0) + c.length }));
      }

      const failures: Record<string, string> = {};
      setEntries((prev) =>
        prev.map((e) => {
          if (e.type_tag !== null) return e;
          const result = detected.get(e.title.trim());
          if (result?.type_tag) {
            // Carry over the cover detect-type already found (if any) — skips
            // a redundant re-fetch in "Ambil cover" for this entry.
            return {
              ...e,
              type_tag: result.type_tag,
              cover_url: result.cover_url ?? null,
              source_api: result.source_api ?? null,
            };
          }
          failures[e.id] =
            result?.reason ?? "jenis tidak terdeteksi — betulkan nama atau tulis (jenis) manual";
          return e;
        }),
      );
      setDetectFailedById(failures);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mendeteksi jenis.");
    } finally {
      setDetecting(false);
    }
  };

  // Deteksi ulang satu entri pakai judul (yang mungkin sudah dibetulkan).
  const handleDetectOne = async (id: string, rawTitle: string) => {
    const title = rawTitle.trim();
    if (title === "") return;
    setErrorMsg(null);
    setRowDetecting(id);
    try {
      const [result] = await detectTypes([title]);
      if (result?.type_tag) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  type_tag: result.type_tag,
                  cover_url: result.cover_url ?? null,
                  source_api: result.source_api ?? null,
                }
              : e,
          ),
        );
        setDetectFailedById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setDetectFailedById((prev) => ({
          ...prev,
          [id]: result?.reason ?? "jenis tidak terdeteksi — betulkan nama atau tulis (jenis) manual",
        }));
      }
    } catch (err) {
      setDetectFailedById((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Gagal mendeteksi jenis.",
      }));
    } finally {
      setRowDetecting(null);
    }
  };

  const handleConfirmImport = async () => {
    setPhase("importing");
    setErrorMsg(null);
    setImportResults([]);
    // Only entries with a resolved type_tag are sent. `id` UI-only — dibuang
    // supaya tidak ikut terkirim ke Worker (BulkEntry tidak punya field itu).
    const toImport = entries
      .filter((e) => e.type_tag !== null)
      .map(({ id, ...rest }) => rest);
    const chunks = chunk(toImport, IMPORT_CHUNK_SIZE);
    setImportProgress({ done: 0, total: toImport.length });

    const allResults: BulkImportResultItem[] = [];
    try {
      for (const c of chunks) {
        const results = await bulkImportComics(c);
        allResults.push(...results);
        setImportProgress((prev) => ({ ...prev, done: prev.done + c.length }));
        setImportResults([...allResults]);
      }
      setPhase("done");
      const created = allResults.filter((r) => r.action === "created").length;
      const updated = allResults.filter((r) => r.action === "updated").length;
      logImportEvent({ status: "success", message: `${created} dibuat, ${updated} diupdate` });
      setHistoryVersion((v) => v + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengimpor data.";
      setErrorMsg(message);
      setPhase("done");
      logImportEvent({ status: "error", message });
      setHistoryVersion((v) => v + 1);
    }
  };

  // Entries created without a cover — detect-type may have already found one
  // (carried through /bulk's response as cover_url), in which case there's
  // nothing left to fetch for that entry.
  const needsCoverBackfill = useMemo(
    () => importResults.filter((r) => r.action === "created" && r.comic_id && !r.cover_url),
    [importResults],
  );

  const handleBackfillCovers = async () => {
    const createdIds = needsCoverBackfill.map((r) => r.comic_id!);
    if (createdIds.length === 0) return;

    setErrorMsg(null);
    const chunks = chunk(createdIds, COVER_CHUNK_SIZE);
    setCoverProgress({ done: 0, total: createdIds.length });

    try {
      for (const c of chunks) {
        await backfillCovers(c);
        setCoverProgress((prev) => ({ ...(prev ?? { done: 0, total: createdIds.length }), done: (prev?.done ?? 0) + c.length }));
      }
      setCoverDone(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengambil cover.");
    }
  };

  const handleReset = () => {
    setText("");
    setPhase("editing");
    setEntries([]);
    setParsedFailed([]);
    setDetectFailedById({});
    setDetectProgress(null);
    setImportProgress({ done: 0, total: 0 });
    setImportResults([]);
    setCoverProgress(null);
    setCoverDone(false);
    setErrorMsg(null);
    setValidation(null);
  };

  const summary = importResults.reduce(
    (acc, r) => {
      acc[r.action] += 1;
      return acc;
    },
    { created: 0, updated: 0, skipped: 0, error: 0 },
  );

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,35%)_minmax(0,1fr)]">
        {/* Kolom kiri: panduan & alat */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-xs text-slate-400 shadow-lg shadow-black/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              Batasan fitur ini
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Format baris harus sesuai: <code>Judul(jenis) : ch12</code>. Pemisah desimal chapter
                yang diterima: titik, koma, atau tanda hubung (mis. <code>ch38-1</code> = 38.1).
              </li>
              <li>
                Kalau <code>(jenis)</code> tidak ditulis, jenis bisa dideteksi otomatis dari beberapa
                sumber publik berurutan (MangaDex, comick.io, AniList, dan Komiku kalau dikonfigurasi
                admin) — hanya untuk komik berbahasa asal Jepang/Korea/China yang terdaftar di salah
                satu sumber itu. Judul yang tidak cocok cukup meyakinkan tidak akan ditebak.
              </li>
              <li>
                Beberapa variasi dinormalisasi otomatis: pemisah <code>;</code>, chapter{" "}
                <code>c13</code>/<code>ch,60</code>, status <code>(end)</code> → completed, tag{" "}
                <code>mangashort</code>/<code>hmanga</code>/<code>manga{"{colored}"}</code> → manga
                (h = 18+; short/colored jadi catatan). Status bebas seperti <code>(hiatus)</code> atau{" "}
                <code>(S1 end)</code> TIDAK ditebak — status jadi ongoing dan teks aslinya disimpan
                sebagai catatan komik.
              </li>
              <li>
                <strong>Status 18+ tidak pernah dideteksi otomatis</strong> — harus ditulis eksplisit
                (mis. <code>(manhwa18)</code>).
              </li>
              <li>
                Kalau deteksi jenis gagal (nama tidak cocok dengan katalog sumber), nama tiap baris
                bisa dibetulkan langsung di pratinjau lalu dideteksi ulang per-baris. Nama yang
                dibetulkan <strong>menggantikan judul seutuhnya</strong> — dipakai untuk deteksi,
                cover, dan disimpan sebagai judul komik.
              </li>
              <li>Judul yang sudah ada akan diupdate chapternya (kalau lebih tinggi), bukan diduplikasi.</li>
              <li>
                Kalau deteksi jenis otomatis dijalankan (baris tanpa <code>(jenis)</code>), cover-nya
                ikut terambil sekaligus untuk baris itu — tombol "Ambil cover" setelah import hanya
                muncul untuk komik yang cover-nya belum ketemu (mis. jenis ditulis manual, atau
                deteksi tidak dijalankan).
              </li>
            </ul>
          </div>

          <ImportFormatPicker onInsertExample={handleTextChange} />
          <div key={historyVersion}>
            <ImportHistoryPanel />
          </div>
        </div>

        {/* Kolom kanan: input & pratinjau */}
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Tempel data historis (format baris bernomor) untuk diimpor langsung — jalur ini{" "}
            <strong>tidak memakai AI sama sekali</strong>, murni parsing deterministik.
          </p>

          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 shadow-xl shadow-black/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Data Historis
              </p>
              {phase === "editing" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearEmptyLines}
                    disabled={text.trim() === ""}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Hapus Baris Kosong
                  </button>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={text.trim() === ""}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Validasi Format
                  </button>
                </div>
              )}
            </div>

            {phase === "editing" && (
              <>
                <LineNumberedTextarea
                  value={text}
                  onChange={handleTextChange}
                  ariaLabel="Teks data historis"
                  placeholder={"162. Judul komik(manga) : ch11\n172.Judul lain(2022)(manhwa):ch32"}
                  heightClassName="max-h-[50vh] min-h-[30vh]"
                />

                {validation && (
                  <div className="mt-3 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs">
                    <p className="text-slate-100">
                      {validation.ok.length} valid, {validation.failed.length} gagal.
                    </p>
                    {validation.failed.length > 0 && (
                      <ul className="mt-1 max-h-40 overflow-y-auto text-rose-300">
                        {validation.failed.map((f) => (
                          <li key={f.line}>
                            Baris {f.line}: {f.reason} — <span className="text-slate-400">{f.raw}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={text.trim() === ""}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    Import Data
                  </button>
                </div>
              </>
            )}

            {phase === "preview" && (
              <div className="rounded-md border border-slate-700 bg-slate-800 p-3">
                <p className="text-sm text-slate-100">
                  {ready.length} siap import, {needsDetection.length} perlu deteksi jenis,{" "}
                  {parsedFailed.length} baris gagal.
                </p>

                {needsDetection.length > 0 && (
                  <div className="mt-2 rounded border border-amber-800/60 bg-amber-950/30 p-2 text-xs text-amber-200">
                    <p>
                      Baris tanpa (jenis) — akan dilewati saat import kalau jenisnya belum terisi.
                      Betulkan nama kalau tidak cocok, lalu deteksi ulang:
                    </p>
                    <ul className="mt-1 max-h-64 space-y-1.5 overflow-y-auto">
                      {needsDetection.map((e) => {
                        const reason = detectFailedById[e.id];
                        return (
                          <li key={e.id}>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={e.title}
                                onChange={(ev) => handleTitleChange(e.id, ev.target.value)}
                                aria-label={`Nama komik baris ch${e.latest_chapter}`}
                                className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                              />
                              <span className="shrink-0 text-amber-300/70">ch{e.latest_chapter}</span>
                              <button
                                type="button"
                                onClick={() => handleDetectOne(e.id, e.title)}
                                disabled={rowDetecting !== null || detecting || e.title.trim() === ""}
                                className="shrink-0 rounded-md border border-amber-700 px-2 py-1 text-amber-200 transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {rowDetecting === e.id ? "Mendeteksi…" : "Deteksi"}
                              </button>
                            </div>
                            {reason && <p className="mt-0.5 text-rose-300">{reason}</p>}
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      onClick={handleDetect}
                      disabled={detecting || rowDetecting !== null}
                      className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                    >
                      {detecting
                        ? `Mendeteksi… ${detectProgress?.done ?? 0} / ${detectProgress?.total ?? 0}`
                        : `Deteksi jenis otomatis (${needsDetection.length} baris)`}
                    </button>
                  </div>
                )}

                {parsedFailed.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-rose-300">
                    {parsedFailed.map((f) => (
                      <li key={f.line}>
                        Baris {f.line}: {f.reason} — <span className="text-slate-400">{f.raw}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={ready.length === 0}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    Import {ready.length} entri
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("editing")}
                    className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Kembali
                  </button>
                </div>
              </div>
            )}

            {phase === "importing" && (
              <p className="text-sm text-slate-300">
                Mengimpor… {importProgress.done} / {importProgress.total}
              </p>
            )}

            {phase === "done" && (
              <div className="rounded-md border border-slate-700 bg-slate-800 p-3">
                <p className="text-sm text-slate-100">
                  Selesai: {summary.created} dibuat, {summary.updated} diupdate, {summary.skipped} dilewati,{" "}
                  {summary.error} gagal.
                </p>
                {summary.created > 0 && needsCoverBackfill.length === 0 && !coverDone && (
                  <p className="mt-2 text-sm text-emerald-400">
                    Semua {summary.created} komik baru sudah dapat cover otomatis saat deteksi jenis.
                  </p>
                )}
                {needsCoverBackfill.length > 0 && !coverDone && (
                  <button
                    type="button"
                    onClick={handleBackfillCovers}
                    disabled={coverProgress !== null}
                    className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    Ambil cover ({needsCoverBackfill.length} komik)
                  </button>
                )}
                {coverProgress !== null && !coverDone && (
                  <p className="mt-2 text-sm text-slate-300">
                    Mengambil cover… {coverProgress.done} / {coverProgress.total}
                  </p>
                )}
                {coverDone && <p className="mt-2 text-sm text-emerald-400">Cover selesai diambil.</p>}
                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-3 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Import lagi
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
