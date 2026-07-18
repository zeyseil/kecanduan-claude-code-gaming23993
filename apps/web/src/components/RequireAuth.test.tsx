import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
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
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>Halaman Login</div>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>Konten Rahasia</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("redirect ke /login kalau tidak ada token", () => {
    renderGuarded();
    expect(screen.getByText("Halaman Login")).toBeInTheDocument();
  });

  it("menampilkan children kalau token ada", () => {
    storage.setItem("komik-tracker:auth-token", "my-token");
    renderGuarded();
    expect(screen.getByText("Konten Rahasia")).toBeInTheDocument();
  });
});
