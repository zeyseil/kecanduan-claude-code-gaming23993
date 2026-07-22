import { useMemo, useState } from "react";
import { parseHistoris, type FailedLine, type ParsedEntry } from "../lib/parseHistoris";
import { chunk } from "../lib/chunk";
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
  const [detectFailed, setDetectFailed] = useState<Array<{ title: string; reason: string }>>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState<{ done: number; total: number } | null>(null);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResults, setImportResults] = useState<BulkImportResultItem[]>([]);
  const [coverProgress, setCoverProgress] = useState<{ done: number; total: number } | null>(null);
  const [coverDone, setCoverDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ready = useMemo(() => entries.filter((e) => e.type_tag !== null), [entries]);
  const needsDetection = useMemo(() => entries.filter((e) => e.type_tag === null), [entries]);

  const handlePreview = () => {
    const result = parseHistoris(text);
    setEntries(result.ok);
    setParsedFailed(result.failed);
    setDetectFailed([]);
    setPhase("preview");
  };

  const handleDetect = async () => {
    setErrorMsg(null);
    setDetecting(true);
    const titles = needsDetection.map((e) => e.title);
    setDetectProgress({ done: 0, total: titles.length });

    try {
      const detected = new Map<string, DetectTypeResultItem>();
      for (const c of chunk(titles, DETECT_CHUNK_SIZE)) {
        const results = await detectTypes(c);
        for (const r of results) detected.set(r.title, r);
        setDetectProgress((prev) => ({ ...(prev ?? { done: 0, total: titles.length }), done: (prev?.done ?? 0) + c.length }));
      }

      const failures: Array<{ title: string; reason: string }> = [];
      setEntries((prev) =>
        prev.map((e) => {
          if (e.type_tag !== null) return e;
          const result = detected.get(e.title);
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
          failures.push({ title: e.title, reason: "jenis tidak terdeteksi di MangaDex/AniList — tulis (jenis) manual" });
          return e;
        }),
      );
      setDetectFailed(failures);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mendeteksi jenis.");
    } finally {
      setDetecting(false);
    }
  };

  const handleConfirmImport = async () => {
    setPhase("importing");
    setErrorMsg(null);
    setImportResults([]);
    // Only entries with a resolved type_tag are sent.
    const toImport = entries.filter((e) => e.type_tag !== null);
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengimpor data.");
      setPhase("done");
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
    setDetectFailed([]);
    setDetectProgress(null);
    setImportProgress({ done: 0, total: 0 });
    setImportResults([]);
    setCoverProgress(null);
    setCoverDone(false);
    setErrorMsg(null);
  };

  const summary = importResults.reduce(
    (acc, r) => {
      acc[r.action] += 1;
      return acc;
    },
    { created: 0, updated: 0, skipped: 0, error: 0 },
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        Tempel data historis (format baris bernomor) untuk diimpor langsung — jalur ini{" "}
        <strong>tidak memakai AI sama sekali</strong>, murni parsing deterministik.
      </p>

      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">Batasan fitur ini:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            Format baris harus sesuai: <code>Judul(jenis) : ch12</code>. Pemisah desimal chapter
            yang diterima: titik, koma, atau tanda hubung (mis. <code>ch38-1</code> = 38.1).
          </li>
          <li>
            Kalau <code>(jenis)</code> tidak ditulis, jenis bisa dideteksi otomatis dari MangaDex
            (fallback AniList) — hanya untuk komik berbahasa asal Jepang/Korea/China yang terdaftar
            di sana. Judul yang tidak cocok cukup meyakinkan tidak akan ditebak.
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
          <li>Judul yang sudah ada akan diupdate chapternya (kalau lebih tinggi), bukan diduplikasi.</li>
          <li>
            Kalau deteksi jenis otomatis dijalankan (baris tanpa <code>(jenis)</code>), cover-nya
            ikut terambil sekaligus untuk baris itu — tombol "Ambil cover" setelah import hanya
            muncul untuk komik yang cover-nya belum ketemu (mis. jenis ditulis manual, atau
            deteksi tidak dijalankan).
          </li>
        </ul>
      </div>

      {phase === "editing" && (
        <>
          <textarea
            aria-label="Teks data historis"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"162. Judul komik(manga) : ch11\n172.Judul lain(2022)(manhwa):ch32"}
            className="max-h-[50vh] min-h-[30vh] resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 font-mono text-sm leading-6 text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePreview}
              disabled={text.trim() === ""}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              Preview
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
              <p>Baris tanpa (jenis) — akan dilewati saat import kalau jenisnya belum terisi:</p>
              <ul className="mt-1 max-h-32 overflow-y-auto">
                {needsDetection.map((e) => (
                  <li key={e.title}>{e.title} : ch{e.latest_chapter}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleDetect}
                disabled={detecting}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
              >
                {detecting
                  ? `Mendeteksi… ${detectProgress?.done ?? 0} / ${detectProgress?.total ?? 0}`
                  : `Deteksi jenis otomatis (${needsDetection.length} baris)`}
              </button>
            </div>
          )}

          {detectFailed.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-rose-300">
              {detectFailed.map((f) => (
                <li key={f.title}>
                  {f.title}: {f.reason}
                </li>
              ))}
            </ul>
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
        <div className="rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
