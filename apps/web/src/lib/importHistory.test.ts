import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getImportHistory, logImportEvent } from "./importHistory";

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

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("importHistory", () => {
  it("mengembalikan array kosong kalau belum ada riwayat", () => {
    expect(getImportHistory()).toEqual([]);
  });

  it("mencatat event dan menaruhnya paling atas (terbaru dulu)", () => {
    logImportEvent({ status: "success", message: "1 dibuat, 0 diupdate" });
    logImportEvent({ status: "error", message: "Worker down" });

    const history = getImportHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ status: "error", message: "Worker down" });
    expect(history[1]).toMatchObject({ status: "success", message: "1 dibuat, 0 diupdate" });
    expect(typeof history[0].timestamp).toBe("number");
  });

  it("membatasi riwayat maksimal 10 entri terbaru", () => {
    for (let i = 0; i < 12; i++) {
      logImportEvent({ status: "success", message: `entri-${i}` });
    }
    const history = getImportHistory();
    expect(history).toHaveLength(10);
    expect(history[0].message).toBe("entri-11");
  });

  it("tidak crash kalau JSON di storage rusak", () => {
    globalThis.localStorage.setItem("komik-tracker:import-history", "{bukan json valid");
    expect(getImportHistory()).toEqual([]);
  });
});
