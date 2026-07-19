// Which Gemini models the user may pick for the "Tulis bebas" workflow, and
// what we can honestly say about their quota.
//
// Why a curated list exists at all, when we also query ListModels: ListModels
// returns everything the key can reach (embedding models, image models, TTS,
// preview builds) and — importantly — carries NO flag for function-calling
// support. This workflow is entirely function calling, so a model that can
// `generateContent` but not call tools would fail at runtime with a confusing
// error. The curated entries are the ones actually exercised against this
// agent; everything else from ListModels is offered but flagged as untested.

export interface ModelQuota {
  /** Requests per minute, free tier. */
  rpm: number;
  /** Requests per day, free tier. */
  rpd: number;
}

export interface CuratedModel {
  id: string;
  label: string;
  note: string;
  quota: ModelQuota;
}

export interface AgentModelOption {
  id: string;
  label: string;
  note: string;
  /** null for models discovered via ListModels that we have no figures for. */
  quota: ModelQuota | null;
  /** false = came from ListModels only, never exercised against this agent. */
  curated: boolean;
}

// IMPORTANT: these figures are LAST-KNOWN ESTIMATES, not something we can
// fetch. Google's rate-limit docs no longer publish per-model RPM/RPD numbers
// at all — the page now defers to each account's own AI Studio dashboard
// (https://aistudio.google.com/rate-limit). Anywhere these numbers surface in
// the UI they must be labelled as estimates alongside a link to that dashboard.
export const AI_STUDIO_RATE_LIMIT_URL = "https://aistudio.google.com/rate-limit";

export const CURATED_MODELS: CuratedModel[] = [
  {
    id: "gemini-flash-lite-latest",
    label: "Flash-Lite (default)",
    note: "Paling cepat (~15 detik/perintah) dan kuota paling longgar. Sudah cukup untuk tugas terstruktur ini.",
    quota: { rpm: 15, rpd: 1000 },
  },
  {
    id: "gemini-flash-latest",
    label: "Flash",
    note: "Lebih pintar tapi jauh lebih lambat (~40 detik/perintah) dan kuota harian sangat ketat.",
    quota: { rpm: 10, rpd: 250 },
  },
  {
    id: "gemini-2.5-flash",
    label: "Flash 2.5",
    note: "Versi lama yang dipatok. Tidak tersedia untuk semua akun — kalau 404, pakai alias -latest.",
    quota: { rpm: 10, rpd: 250 },
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Flash-Lite 2.5",
    note: "Versi Flash-Lite yang dipatok, berguna kalau alias -latest berubah perilaku.",
    quota: { rpm: 15, rpd: 1000 },
  },
];

/** Shape of one entry in the ListModels response we care about. */
export interface ListedModel {
  /** Fully-qualified, e.g. "models/gemini-flash-lite-latest". */
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

/** ListModels returns "models/<id>"; everywhere else we use the bare id. */
export function stripModelPrefix(name: string): string {
  return name.startsWith("models/") ? name.slice("models/".length) : name;
}

// Name fragments that mark a model as irrelevant here. Heuristic on purpose:
// the API exposes no capability flag for function calling, so this is the only
// signal available short of calling each model and seeing what breaks.
const EXCLUDED_FRAGMENTS = [
  "embedding",
  "embed",
  "aqa",
  "imagen",
  "image",
  "tts",
  "live",
  "vision",
  "veo",
  "computer-use",
];

export function isSuitableForAgent(model: ListedModel): boolean {
  if (typeof model.name !== "string" || model.name.trim() === "") return false;

  const id = stripModelPrefix(model.name).toLowerCase();
  if (!id.startsWith("gemini")) return false;
  if (!(model.supportedGenerationMethods ?? []).includes("generateContent")) return false;

  return !EXCLUDED_FRAGMENTS.some((fragment) => id.includes(fragment));
}

/**
 * Merges the curated list with whatever the user's key can actually reach.
 *
 * Curated entries come first and always survive, even when ListModels omits
 * them — a key with restricted access shouldn't make the default model vanish
 * from the dropdown. Discovered extras follow, sorted, marked untested.
 */
export function buildModelOptions(listed: ListedModel[]): AgentModelOption[] {
  const curated: AgentModelOption[] = CURATED_MODELS.map((model) => ({
    ...model,
    curated: true,
  }));
  const curatedIds = new Set(curated.map((model) => model.id));

  const discovered: AgentModelOption[] = listed
    .filter(isSuitableForAgent)
    .map((model) => stripModelPrefix(model.name!))
    .filter((id) => !curatedIds.has(id))
    .sort()
    .map((id) => ({
      id,
      label: id,
      note: "Terdeteksi dari API key kamu, belum diuji untuk fitur ini.",
      quota: null,
      curated: false,
    }));

  return [...curated, ...discovered];
}
