import { getImportHistory } from "../lib/importHistory";

/** Kartu riwayat impor — dibaca ulang tiap render (BulkImportPanel re-render
 * setiap state berubah, jadi entri baru muncul tanpa state/context tambahan). */
export function ImportHistoryPanel() {
  const history = getImportHistory().slice(0, 3);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 shadow-lg shadow-black/20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Riwayat Impor Terakhir
      </p>
      {history.length === 0 ? (
        <p className="text-xs text-slate-500">Belum ada riwayat impor di perangkat ini.</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {history.map((entry, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span aria-hidden="true">{entry.status === "success" ? "✅" : "❌"}</span>
              <span className={entry.status === "success" ? "text-emerald-300" : "text-rose-300"}>
                {new Date(entry.timestamp).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                , {entry.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
