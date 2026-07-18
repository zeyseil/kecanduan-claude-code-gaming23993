const GOOGLE_API_KEY_STORAGE_KEY = "komik-tracker:google-api-key";
const AUTH_TOKEN_STORAGE_KEY = "komik-tracker:auth-token";

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
