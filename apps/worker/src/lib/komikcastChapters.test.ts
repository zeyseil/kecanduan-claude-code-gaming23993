import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrlKomikcast } from "./komikcastChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const SOLO_LEVELING_SEARCH = {
  data: [
    { id: 7126, data: { title: "Solo Leveling", nativeTitle: "나 혼자만 레벨업", slug: "solo-leveling" } },
  ],
};

function chaptersResponse(indexes: number[]) {
  return { data: indexes.map((index, i) => ({ id: i, data: { index, slug: null } })) };
}

function stub(searchBody: unknown, chaptersBody: unknown, opts: { chaptersStatus?: number } = {}) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/series?title=")) return new Response(JSON.stringify(searchBody), { status: 200 });
    if (u.includes("/chapters")) {
      return new Response(JSON.stringify(chaptersBody), { status: opts.chaptersStatus ?? 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrlKomikcast", () => {
  it("finds the closest chapter above afterChapter (argmin over an unsorted list)", async () => {
    stub(SOLO_LEVELING_SEARCH, chaptersResponse([178, 180, 179]));
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 178, fakeEnv);
    expect(result).toEqual({ read_url: "https://v3.komikcast.fit/series/solo-leveling/chapter/179" });
  });

  it("handles a chapter index containing a decimal point", async () => {
    stub(SOLO_LEVELING_SEARCH, chaptersResponse([179, 179.6]));
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 179, fakeEnv);
    expect(result).toEqual({ read_url: "https://v3.komikcast.fit/series/solo-leveling/chapter/179.6" });
  });

  it("returns a reason when search finds no result", async () => {
    stub({ data: [] }, chaptersResponse([]));
    const result = await findNextChapterUrlKomikcast("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when search finds results but none pass the title gate", async () => {
    stub(
      { data: [{ id: 1, data: { title: "Completely Different Manga", nativeTitle: "", slug: "cdm" } }] },
      chaptersResponse([]),
    );
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when the search request fails", async () => {
    const fn = vi.fn(async () => new Response("error", { status: 500 }));
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when the chapters request fails after a successful search", async () => {
    stub(SOLO_LEVELING_SEARCH, {}, { chaptersStatus: 500 });
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari Komikcast" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stub(SOLO_LEVELING_SEARCH, chaptersResponse([5]));
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komikcast" });
  });
});
