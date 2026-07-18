import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";

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
  vi.stubGlobal("location", { href: "" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("attaches Authorization header when a token is stored", async () => {
    storage.setItem("komik-tracker:auth-token", "my-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://localhost:8787/comics");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics",
      expect.objectContaining({ headers: { Authorization: "Bearer my-token" } }),
    );
  });

  it("sends no Authorization header when no token is stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("http://localhost:8787/comics");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("clears the token and redirects to /login on 401", async () => {
    storage.setItem("komik-tracker:auth-token", "stale-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));

    await apiFetch("http://localhost:8787/comics");

    expect(storage.getItem("komik-tracker:auth-token")).toBeNull();
    expect((globalThis.location as unknown as { href: string }).href).toBe("/login");
  });
});
