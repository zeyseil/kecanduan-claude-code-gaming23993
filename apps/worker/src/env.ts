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
  /** (Opsional) Override base URL Kiryuu. Kosong = default https://v7.kiryuu.to
   * (lihat lib/kiryuu.ts). Escape-hatch kalau Kiryuu pindah versi domain
   * (v7 -> v8 dst, situs ini pernah beberapa kali). */
  KIRYUU_API_URL?: string;
  /** (Opsional) Override base URL Komikcast. Kosong = default
   * https://v3.komikcast.fit (lihat lib/komikcast.ts). Escape-hatch kalau
   * Komikcast pindah domain (situs ini sering rotasi). */
  KOMIKCAST_API_URL?: string;
  RATE_LIMITER: DurableObjectNamespace;
  USER_RATE_LIMITER: DurableObjectNamespace;
  AUTH_TOKENS: KVNamespace;
  /** Headless Chromium terkelola (Cloudflare Browser Rendering) — dipakai
   * HANYA oleh sumber Komikcast (lib/komikcast.ts) untuk melewati Cloudflare
   * bot-challenge yang memblokir fetch() biasa. Binding wajib (bukan optional
   * string seperti env di atas) — lihat [browser] di wrangler.toml. */
  BROWSER: Fetcher;
}
