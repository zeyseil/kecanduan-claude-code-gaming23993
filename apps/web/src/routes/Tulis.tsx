import { useState } from "react";
import { TextEditor } from "../components/TextEditor";
import { processAgentText } from "../lib/api/agent";
import { getGoogleApiKey, setGoogleApiKey } from "../lib/storage";
import { extractAgentMessage } from "../lib/parseAgentResult";

type Status = "idle" | "processing" | "success" | "error";

export function Tulis() {
  const [apiKey, setApiKey] = useState(() => getGoogleApiKey());
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setGoogleApiKey(value);
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
      const response = await processAgentText({ teks_input: text, google_api_key: apiKey });
      setResult(response);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses teks.");
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-lg font-semibold text-slate-100">Tulis</h1>
      <p className="mb-4 text-sm text-slate-400">
        Catat bacaan baru atau update chapter. Tekan Proses untuk mengirim ke AI agent.
      </p>

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
          {extractAgentMessage(result) ? (
            <p className="text-sm text-slate-100">{extractAgentMessage(result)}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Tidak bisa membaca ringkasan balasan (bentuk respons tidak dikenal) — lihat detail
              JSON di bawah.
            </p>
          )}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
              Lihat detail JSON
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
