import { useState } from "react";
import { fetchGeminiModels, type AgentModelOption } from "../lib/api/agent";

const AI_STUDIO_RATE_LIMIT_URL = "https://aistudio.google.com/rate-limit";

// Daftar kurasi awal — tersedia tanpa API key, digabung dengan hasil ListModels
// kalau user menekan tombol muat. Dijaga sinkron dengan CURATED_MODELS di
// apps/worker/src/agent/models.ts (id-nya harus cocok).
const INITIAL_MODELS: AgentModelOption[] = [
  {
    id: "gemini-flash-lite-latest",
    label: "Flash-Lite (default)",
    note: "Paling cepat & kuota paling longgar. Cukup untuk fitur ini.",
    quota: { rpm: 15, rpd: 1000 },
    curated: true,
  },
  {
    id: "gemini-flash-latest",
    label: "Flash",
    note: "Lebih pintar tapi lebih lambat, kuota harian ketat.",
    quota: { rpm: 10, rpd: 250 },
    curated: true,
  },
  {
    id: "gemini-2.5-flash",
    label: "Flash 2.5",
    note: "Versi lama dipatok. 404 di sebagian akun — pakai alias -latest.",
    quota: { rpm: 10, rpd: 250 },
    curated: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Flash-Lite 2.5",
    note: "Versi Flash-Lite dipatok.",
    quota: { rpm: 15, rpd: 1000 },
    curated: true,
  },
];

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
  const [models, setModels] = useState<AgentModelOption[]>(INITIAL_MODELS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleLoad = async () => {
    if (apiKey.trim() === "") {
      setError("Isi API key Gemini dulu untuk memuat daftar model.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchGeminiModels({ google_api_key: apiKey });
      setModels(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar model.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4 rounded-md border border-slate-700 bg-slate-800 p-3">
      <label
        htmlFor="gemini-model"
        className="mb-1 block text-xs uppercase tracking-wide text-slate-400"
      >
        Model Gemini
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id="gemini-model"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none"
        >
          <option value="">Default Worker (Flash-Lite)</option>
          {options.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
              {model.curated ? "" : " — belum diuji"} · {quotaText(model)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Memuat…" : "Muat dari API key"}
        </button>
      </div>

      {selected && <p className="mt-1 text-xs text-slate-500">{selected.note}</p>}
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

      <p className="mt-2 text-xs text-slate-500">
        Angka kuota di atas adalah <strong>perkiraan</strong> dan bisa berubah — angka pasti untuk
        akun Anda ada di{" "}
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
