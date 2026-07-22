const GOOGLE_API_KEY_STORAGE_KEY = "komik-tracker:google-api-key";
const AUTH_TOKEN_STORAGE_KEY = "komik-tracker:auth-token";
const GEMINI_MODEL_STORAGE_KEY = "komik-tracker:gemini-model";
const SAFE_MODE_STORAGE_KEY = "komik-tracker:safe-mode";

/** API key Gemini milik user sendiri — hanya disimpan di browser, tidak pernah dikirim ke server manapun selain per-request ke /agent/process. */
export function getGoogleApiKey(): string {
  return globalThis.localStorage.getItem(GOOGLE_API_KEY_STORAGE_KEY) ?? "";
}

export function setGoogleApiKey(value: string): void {
  if (value === "") {
    globalThis.localStorage.removeItem(GOOGLE_API_KEY_STORAGE_KEY);
    return;
  }
  globalThis.localStorage.setItem(GOOGLE_API_KEY_STORAGE_KEY, value);
}

/** Model Gemini pilihan user untuk fitur Tulis bebas — device-only, dikirim per-request ke /agent/process. Kosong = pakai default Worker. */
export function getGeminiModel(): string {
  return globalThis.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) ?? "";
}

export function setGeminiModel(value: string): void {
  if (value === "") {
    globalThis.localStorage.removeItem(GEMINI_MODEL_STORAGE_KEY);
    return;
  }
  globalThis.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, value);
}

/** Mode Aman: blur cover komik 18+ sampai user membukanya. Device-only.
 * Default ON (true) kalau belum pernah di-set — cover dewasa tidak tampil tak sengaja. */
export function getSafeMode(): boolean {
  return globalThis.localStorage.getItem(SAFE_MODE_STORAGE_KEY) !== "off";
}

export function setSafeMode(on: boolean): void {
  globalThis.localStorage.setItem(SAFE_MODE_STORAGE_KEY, on ? "on" : "off");
}

/** Token login (dari provisioning manual lewat wrangler kv), dikirim sebagai Authorization: Bearer ke Worker. */
export function getAuthToken(): string | null {
  return globalThis.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(value: string): void {
  globalThis.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
}

export function clearAuthToken(): void {
  globalThis.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
