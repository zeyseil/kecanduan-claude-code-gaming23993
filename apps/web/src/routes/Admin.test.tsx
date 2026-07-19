import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Admin } from "./Admin";

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const HEALTH = {
  astra: "ok",
  gemini_model: "(default)",
  bindings: { auth_tokens: true, rate_limiter: true, user_rate_limiter: true },
  activity_24h: { total: 3, byAction: { created: 2, updated: 1, ambiguous: 0 }, lastActivityPerUser: [] },
};
const USERS = {
  users: [
    { token_masked: "adm1…xyz", user_id: "owner", role: "admin", comic_count: 5, last_activity: null },
    { token_masked: "usr1…abc", user_id: "budi", role: "user", comic_count: 2, last_activity: "2026-01-01T00:00:00.000Z" },
  ],
  list_complete: true,
};
const LOGS = { logs: [{ ts: "2026-01-02T00:00:00.000Z", input_text: "baca naruto", ai_action: "updated", target_comic_id: "c1", confirmed: true }] };

function routedFetch(overrides: Record<string, () => Response> = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/admin/health")) return (overrides["health"] ?? (() => new Response(JSON.stringify(HEALTH), { status: 200 })))();
    if (u.includes("/admin/users")) return (overrides["users"] ?? (() => new Response(JSON.stringify(USERS), { status: 200 })))();
    if (u.includes("/admin/logs")) return (overrides["logs"] ?? (() => new Response(JSON.stringify(LOGS), { status: 200 })))();
    if (u.includes("/admin/tokens")) return (overrides["tokens"] ?? (() => new Response(JSON.stringify({ token: "brand-new-token", user_id: "citra" }), { status: 201 })))();
    return new Response("{}", { status: 200 });
  });
}

beforeEach(() => {
  const storage = fakeLocalStorage();
  storage.setItem("komik-tracker:auth-token", "admin-token");
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

describe("Admin", () => {
  it("menampilkan blok batasan fitur", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderAdmin();
    expect(screen.getByText("Batasan fitur ini:")).toBeInTheDocument();
  });

  it("memuat kesehatan, user, dan statistik", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderAdmin();
    await waitFor(() => expect(screen.getByText("budi")).toBeInTheDocument());
    expect(screen.getByText("sehat")).toBeInTheDocument();
    // total komik = 5 + 2
    expect(screen.getByText("Total komik (semua user): 7")).toBeInTheDocument();
  });

  it("membuat token dan menampilkannya sekali", async () => {
    vi.stubGlobal("fetch", routedFetch());
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByText("budi")).toBeInTheDocument());

    await user.type(screen.getByLabelText("user_id untuk token baru"), "citra");
    await user.click(screen.getByRole("button", { name: "Buat token" }));

    await waitFor(() => expect(screen.getByText("brand-new-token")).toBeInTheDocument());
  });

  it("mencabut akses lewat konfirmasi dua langkah", async () => {
    const revokeFn = vi.fn(() => new Response(JSON.stringify({ revoked: 1, skipped_admin: 0 }), { status: 200 }));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/admin/users/budi/tokens") && init?.method === "DELETE") return revokeFn();
      if (u.includes("/admin/health")) return new Response(JSON.stringify(HEALTH), { status: 200 });
      if (u.includes("/admin/users")) return new Response(JSON.stringify(USERS), { status: 200 });
      if (u.includes("/admin/logs")) return new Response(JSON.stringify(LOGS), { status: 200 });
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAdmin();
    await waitFor(() => expect(screen.getByText("budi")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cabut akses" }));
    await user.click(screen.getByRole("button", { name: "Ya, cabut" }));

    await waitFor(() => expect(revokeFn).toHaveBeenCalled());
  });

  it("admin tidak punya tombol cabut", async () => {
    vi.stubGlobal("fetch", routedFetch());
    renderAdmin();
    await waitFor(() => expect(screen.getByText("owner")).toBeInTheDocument());
    // only one revoke button (for budi), not for owner
    expect(screen.getAllByRole("button", { name: "Cabut akses" })).toHaveLength(1);
  });
});
