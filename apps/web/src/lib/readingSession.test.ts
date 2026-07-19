import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markReadingStarted, takeReadingSession } from "./readingSession";

// Sama seperti storage.test.ts: stub sendiri daripada bergantung pada
// implementasi sessionStorage bawaan lingkungan test.
function fakeSessionStorage(): Storage {
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

describe("readingSession", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", fakeSessionStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mengembalikan null kalau belum ada sesi ditandai", () => {
    expect(takeReadingSession()).toBeNull();
  });

  it("mengembalikan comic_id yang ditandai lalu menghapusnya (sekali pakai)", () => {
    markReadingStarted("comic-1");
    expect(takeReadingSession()).toBe("comic-1");
    expect(takeReadingSession()).toBeNull();
  });

  it("menimpa sesi lama kalau ditandai lagi sebelum diambil", () => {
    markReadingStarted("comic-1");
    markReadingStarted("comic-2");
    expect(takeReadingSession()).toBe("comic-2");
  });
});
