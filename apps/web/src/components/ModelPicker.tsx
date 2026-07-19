import { useEffect, useState } from "react";
import { fetchGeminiModels, type AgentModelOption } from "../lib/api/agent";

const AI_STUDIO_RATE_LIMIT_URL = "https://aistudio.google.com/rate-limit";

// Auto-load debounce: waits this long after the user stops typing the API key
// before hitting /agent/models, so keystrokes don't each fire a request.
const LOAD_DEBOUNCE_MS = 600;

interface ModelPickerProps {
  value: string;
  onChange: (modelId: string) => void;
  /** API key dipakai untuk memuat daftar model dari akun user. */
  apiKey: string;
}

function quotaText(option: AgentModelOption): string {
  if (!option.quota) return "kuota belum diketahui";
  return `~${option.quota.rpm} req/menit, ~${option.quota.rpd} req/hari`;
}

export function ModelPicker({ value, onChange, apiKey }: ModelPickerProps) {
  const [models, setModels] = useState<AgentModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced auto-load: fires LOAD_DEBOUNCE_MS after apiKey settles. Empty key
  // clears the list immediately (no fetch, no stale error left over).
  useEffect(() => {
    if (apiKey.trim() === "") {
      setModels([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      fetchGeminiModels({ google_api_key: apiKey })
        .then((fetched) => setModels(fetched))
        .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat daftar model."))
        .finally(() => setLoading(false));
    }, LOAD_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [apiKey]);

  // Model tersimpan mungkin bukan salah satu dari daftar (mis. dipilih lalu
  // daftar berubah) — pastikan tetap muncul sebagai opsi supaya select valid.
  const knownIds = new Set(models.map((m) => m.id));
  const options =
    value && !knownIds.has(value)
      ? [
          ...models,
          {
            id: value,
            label: value,
            note: "Model tersimpan sebelumnya.",
            quota: null,
            curated: false,
          } as AgentModelOption,
        ]
      : models;

  const selected = options.find((m) => m.id === value) ?? null;
  const showingPlaceholder = apiKey.trim() === "" || loading || options.length === 0;

  return (
    <div className="mb-4 rounded-md border border-slate-700 bg-slate-800 p-3">
      <label
        htmlFor="gemini-model"
        className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
      >
        Model Gemini
      </label>
      <select
        id="gemini-model"
        value={showingPlaceholder ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={showingPlaceholder}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none disabled:opacity-60"
      >
        {apiKey.trim() === "" ? (
          <option value="" disabled>
            Isi API key Gemini dulu
          </option>
        ) : loading ? (
          <option value="" disabled>
            Memuat model…
          </option>
        ) : options.length === 0 ? (
          <option value="" disabled>
            Tidak ada model yang cocok ditemukan
          </option>
        ) : (
          options.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
              {model.curated ? "" : " — belum diuji"} · {quotaText(model)}
            </option>
          ))
        )}
      </select>

      {selected && <p className="mt-1 text-xs text-slate-500">{selected.note}</p>}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      <p className="mt-2 text-xs text-slate-500">
        Daftar model dimuat otomatis begitu API key valid. Angka kuota di atas adalah{" "}
        <strong>perkiraan</strong> dan bisa berubah — angka pasti untuk akun Anda ada di{" "}
        <a
          href={AI_STUDIO_RATE_LIMIT_URL}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-400 hover:underline"
        >
          dashboard AI Studio
        </a>
        .
      </p>
    </div>
  );
}
