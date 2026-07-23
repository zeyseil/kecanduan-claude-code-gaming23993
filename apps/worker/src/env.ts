export interface Env {
  ASTRA_DB_API_ENDPOINT: string;
  ASTRA_DB_APPLICATION_TOKEN: string;
  ASTRA_DB_COLLECTION: string;
  PROCESS_LOG_COLLECTION: string;
  /** Optional override for the Gemini model used by the agent — see
   * DEFAULT_GEMINI_MODEL in agent/geminiClient.ts. */
  GEMINI_MODEL?: string;
  /** Comma-separated list of browser origins allowed to call this Worker.
   * Empty/unset falls back to the local vite dev server. */
  ALLOWED_ORIGINS?: string;
  /** (Opsional) Override base URL API comick.io. Kosong = default
   * https://api.comick.dev (lihat lib/comick.ts). comick adalah sumber BAWAAN
   * yang selalu aktif — env ini hanya escape-hatch kalau comick pindah domain
   * lagi (fun→io→dev) atau kamu memakai proxy sendiri. */
  COMICK_API_URL?: string;
  /** Base URL instance Komiku REST API (VernSG). Kosong = pakai default publik
   * di lib/komiku.ts. */
  KOMIKU_API_URL?: string;
  /** (Opsional) Override base URL API Shinigami. Kosong = default
   * https://api.shngm.io (lihat lib/shinigami.ts). Escape-hatch kalau Shinigami
   * pindah domain mirror (g/d/dev.shinigami.asia). */
  SHINIGAMI_API_URL?: string;
  /** (Opsional) Override base URL frontend Shinigami untuk membangun link baca
   * chapter. Kosong = default https://g.shinigami.asia. */
  SHINIGAMI_READER_URL?: string;
  RATE_LIMITER: DurableObjectNamespace;
  USER_RATE_LIMITER: DurableObjectNamespace;
  AUTH_TOKENS: KVNamespace;
}
