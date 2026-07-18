import { clearAuthToken, getAuthToken } from "../storage";

/**
 * Shared fetch wrapper for all Worker calls: attaches the auth token as
 * `Authorization: Bearer <token>` and, on 401 (missing/invalid/revoked
 * token), clears it and redirects to /login.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    clearAuthToken();
    globalThis.location.href = "/login";
  }

  return res;
}
