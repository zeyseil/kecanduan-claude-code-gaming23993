import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAdmin } from "./RequireAdmin";

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

let storage: Storage;

beforeEach(() => {
  storage = fakeLocalStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<div>Beranda</div>} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <div>Isi Admin</div>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  it("redirect ke / kalau tidak ada token", async () => {
    renderGuarded();
    await waitFor(() => expect(screen.getByText("Beranda")).toBeInTheDocument());
  });

  it("redirect ke / kalau health 403 (bukan admin)", async () => {
    storage.setItem("komik-tracker:auth-token", "user-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Butuh akses admin" }), { status: 403 })));
    renderGuarded();
    await waitFor(() => expect(screen.getByText("Beranda")).toBeInTheDocument());
  });

  it("menampilkan children kalau health ok (admin)", async () => {
    storage.setItem("komik-tracker:auth-token", "admin-token");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ astra: "ok" }), { status: 200 })));
    renderGuarded();
    await waitFor(() => expect(screen.getByText("Isi Admin")).toBeInTheDocument());
  });
});
