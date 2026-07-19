import { errorMessage } from "./comics";
import { apiFetch } from "./client";

const BASE_URL = import.meta.env.VITE_WORKER_URL ?? "http://localhost:8787";

export type AiAction = "created" | "updated" | "ambiguous";

export interface AdminActivity {
  total: number;
  byAction: Record<AiAction, number>;
  lastActivityPerUser: Array<{ user_id: string; last_at: string }>;
}

export interface AdminHealth {
  astra: "ok" | "down";
  astra_detail?: string;
  gemini_model: string;
  bindings: { auth_tokens: boolean; rate_limiter: boolean; user_rate_limiter: boolean };
  activity_24h: AdminActivity | null;
}

export interface AdminUser {
  token_masked: string;
  user_id: string;
  role: "admin" | "user";
  comic_count: number;
  last_activity: string | null;
}

export interface AdminLog {
  ts: string;
  input_text: string;
  ai_action: AiAction;
  target_comic_id: string | null;
  confirmed: boolean;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<T>;
}

export function fetchAdminHealth(): Promise<AdminHealth> {
  return getJson<AdminHealth>("/admin/health");
}

export async function fetchAdminUsers(): Promise<{ users: AdminUser[]; list_complete: boolean }> {
  return getJson<{ users: AdminUser[]; list_complete: boolean }>("/admin/users");
}

export async function fetchAdminLogs(): Promise<AdminLog[]> {
  const body = await getJson<{ logs: AdminLog[] }>("/admin/logs");
  return body.logs;
}

/** Returns the full token ONCE — the caller must show it immediately, it can't
 * be read again. */
export async function createToken(userId: string): Promise<{ token: string; user_id: string }> {
  const res = await apiFetch(`${BASE_URL}/admin/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<{ token: string; user_id: string }>;
}

/** Revokes access by user_id (removes every non-admin token for that user).
 * The UI never handles raw token strings — only user_id. */
export async function revokeUserAccess(userId: string): Promise<{ revoked: number; skipped_admin: number }> {
  const res = await apiFetch(`${BASE_URL}/admin/users/${encodeURIComponent(userId)}/tokens`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<{ revoked: number; skipped_admin: number }>;
}
