const GOOGLE_API_KEY_STORAGE_KEY = "komik-tracker:google-api-key";

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
