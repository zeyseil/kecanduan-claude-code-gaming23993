import { useState } from "react";
import { TextEditor } from "../components/TextEditor";

export function Tulis() {
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-lg font-semibold text-slate-100">Tulis</h1>
      <p className="mb-4 text-sm text-slate-400">
        Catat bacaan baru atau update chapter. Tekan Proses untuk mengirim ke AI
        (belum tersambung ke backend).
      </p>

      <TextEditor onProcess={setLastSubmitted} />

      {lastSubmitted !== null && (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-3">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
            Teks yang akan dikirim (mock)
          </p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-200">
            {lastSubmitted}
          </pre>
        </div>
      )}
    </div>
  );
}
