import { useState } from "react";
import { TextEditor } from "../components/TextEditor";
import { BulkImportPanel } from "../components/BulkImportPanel";
import { ModelPicker } from "../components/ModelPicker";
import { processAgentText, type AgentResult } from "../lib/api/agent";
import {
  getGoogleApiKey,
  setGoogleApiKey,
  getGeminiModel,
  setGeminiModel,
} from "../lib/storage";

type Status = "idle" | "processing" | "success" | "error";
type Mode = "ai" | "import";

export function Tulis() {
  const [mode, setMode] = useState<Mode>("ai");
  const [apiKey, setApiKey] = useState(() => getGoogleApiKey());
  const [model, setModel] = useState(() => getGeminiModel());
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setGoogleApiKey(value);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setGeminiModel(value);
  };

  const handleProcess = async (text: string) => {
    if (apiKey.trim() === "") {
      setStatus("error");
      setErrorMsg("Isi API key Gemini dulu sebelum memproses.");
      return;
    }

    setStatus("processing");
    setErrorMsg(null);
    setResult(null);

    try {
      const response = await processAgentText({
        teks_input: text,
        google_api_key: apiKey,
        model: model === "" ? undefined : model,
      });
      setResult(response);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses teks.");
      setStatus("error");
    }
  };

  return (
    <div className={`mx-auto ${mode === "import" ? "max-w-7xl" : "max-w-3xl"}`}>
      <h1 className="mb-1 text-lg font-semibold text-slate-100">Tulis</h1>
      <p className="mb-4 text-sm text-slate-400">
        Catat bacaan baru atau update chapter, atau impor data historis sekali jalan.
      </p>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "ai"
              ? "bg-indigo-600 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Tulis bebas
        </button>
        <button
          type="button"
          onClick={() => setMode("import")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "import"
              ? "bg-indigo-600 text-white"
              : "border border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Import historis
        </button>
      </div>

      {mode === "ai" && (
        <>
          <div className="mb-4 rounded-md border border-slate-700 bg-slate-800 p-3">
            <label
              htmlFor="google-api-key"
              className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
            >
              Google API Key (Gemini)
            </label>
            <input
              id="google-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Disimpan hanya di browser Anda, dikirim per-request ke AI agent. Dapatkan API key
              gratis di{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline"
              >
                aistudio.google.com/apikey
              </a>
              .
            </p>
          </div>

          <ModelPicker value={model} onChange={handleModelChange} apiKey={apiKey} />

          <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
            <p className="mb-1 font-medium text-slate-300">Batasan fitur ini:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Kuota gratis Gemini dihitung <strong>per model per hari</strong>. Satu perintah
                memakai <strong>4–6 request</strong> (tiap langkah tool = 1 request), jadi kira-kira
                hanya 3–5 perintah/hari per model di tier paling ketat.
              </li>
              <li>
                Ganti model = ember kuota terpisah — <strong>kecuali</strong>{" "}
                <code>gemini-flash-latest</code> yang menunjuk ke model Flash yang sama, jadi ganti
                alias itu tidak menambah kuota.
              </li>
              <li>
                Satu perintah = satu komik. Untuk banyak judul sekaligus, pakai{" "}
                <strong>Import historis</strong> (tanpa AI, tanpa kuota) atau tombol{" "}
                <strong>Tambah Komik</strong> manual di Daftar Komik.
              </li>
              <li>
                Kalau proses gagal di tengah, komik yang baru dibuat di proses itu dihapus otomatis;
                update chapter yang sudah masuk tidak dibatalkan.
              </li>
              <li>Angka kuota di atas perkiraan — angka pasti ada di dashboard AI Studio akun Anda.</li>
            </ul>
          </div>

          <TextEditor onProcess={handleProcess} disabled={status === "processing"} />

          {status === "error" && errorMsg && (
            <div className="mt-4 rounded-md border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-300">
              {errorMsg}
            </div>
          )}

          {status === "success" && result !== null && (
            <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                Hasil dari AI agent
              </p>
              {result.message ? (
                <p className="text-sm text-slate-100">{result.message}</p>
              ) : (
                <p className="text-sm text-slate-400">
                  AI tidak mengembalikan ringkasan teks — lihat detail langkah di bawah.
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                  Lihat detail langkah ({result.tool_calls.length} tool dipanggil)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-300">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </>
      )}

      {mode === "import" && <BulkImportPanel />}
    </div>
  );
}
