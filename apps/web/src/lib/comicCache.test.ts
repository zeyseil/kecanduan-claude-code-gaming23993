import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Comic } from "../types/comic";
import { clearComicCache, readComicCache, writeComicCache } from "./comicCache";

// Stub localStorage sendiri (pola sama seperti storage.test.ts) — Node + jsdom
// di environment ini bentrok pada global storage bawaan.
function makeFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

const comic: Comic = {
  comic_id: "c-1",
  title: "Cached Comic",
  aliases: [],
  type_tag: "manga",
  is_adult: false,
  latest_chapter: 3,
  status: "ongoing",
  cover_url: null,
  read_url: null,
  release_day: null,
  note: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.stubGlobal("localStorage", makeFakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("comicCache", () => {
  it("round-trips a comic list", () => {
    writeComicCache([comic]);
    expect(readComicCache()).toEqual([comic]);
  });

  it("returns null when empty", () => {
    expect(readComicCache()).toBeNull();
  });

  it("treats corrupt JSON as no cache instead of throwing", () => {
    globalThis.localStorage.setItem("komik-tracker:comics-cache", "{not json");
    expect(readComicCache()).toBeNull();
  });

  it("treats a non-array value as no cache", () => {
    globalThis.localStorage.setItem("komik-tracker:comics-cache", JSON.stringify({ a: 1 }));
    expect(readComicCache()).toBeNull();
  });

  it("clearComicCache removes the entry", () => {
    writeComicCache([comic]);
    clearComicCache();
    expect(readComicCache()).toBeNull();
  });
});
