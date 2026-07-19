// The AUTH_TOKENS KV maps a token to either:
//   - a bare user_id string (legacy format, all tokens provisioned before the
//     admin dashboard existed — e.g. "sigma-god"), or
//   - a JSON object {"user_id":"x","role":"admin"|"user"} (new format).
//
// parseAuthValue() is the single place that understands both, so every legacy
// token keeps working with zero migration: a value that isn't valid JSON, or
// is JSON but not an object with a string user_id, is treated as a bare user_id
// with role "user". Admin role can therefore only ever come from a deliberately
// JSON-encoded value written via wrangler — never inferred.
export type Role = "admin" | "user";
export type AuthPrincipal = { userId: string; role: Role };

export function parseAuthValue(raw: string): AuthPrincipal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { userId: raw, role: "user" };
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as { user_id?: unknown }).user_id === "string"
  ) {
    const obj = parsed as { user_id: string; role?: unknown };
    const role: Role = obj.role === "admin" ? "admin" : "user";
    return { userId: obj.user_id, role };
  }

  // Valid JSON but not our object shape (e.g. a bare JSON string "\"foo\"" or a
  // number) — fall back to treating the original raw text as the user_id.
  return { userId: raw, role: "user" };
}
