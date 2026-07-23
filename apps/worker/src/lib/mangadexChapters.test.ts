import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrlMangaDex } from "./mangadexChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const SEARCH_RESULT = {
  data: [
    {
      id: "manga-123",
      attributes: { title: { en: "Berserk" }, altTitles: [], originalLanguage: "ja" },
      relationships: [{ type: "cover_art", attributes: { fileName: "c.jpg" } }],
    },
  ],
};

function chapter(id: string, chap: string) {
  return { id, attributes: { chapter: chap } };
}

/** Feed is requested descending (order[chapter]=desc). */
function stubFetch(page0: unknown[], page1?: unknown[]) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/manga?title=")) {
      return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
    }
    if (u.includes("/chapter?manga=")) {
      const offset = new URL(u).searchParams.get("offset");
      const data = offset === "100" ? (page1 ?? []) : page0;
      return new Response(JSON.stringify({ data }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrlMangaDex", () => {
  it("finds the closest chapter above afterChapter and builds a mangadex.org reader URL", async () => {
    stubFetch([
      chapter("aaa", "202"),
      chapter("bbb", "201"),
      chapter("ccc", "200"),
      chapter("ddd", "199"),
    ]);
    const result = await findNextChapterUrlMangaDex("Berserk", 200, fakeEnv);
    expect(result).toEqual({ read_url: "https://mangadex.org/chapter/bbb" });
  });

  it("pages forward when the boundary chapter isn't on the first page", async () => {
    stubFetch(
      [chapter("aaa", "205"), chapter("bbb", "204")],
      [chapter("ccc", "203"), chapter("ddd", "100")],
    );
    const result = await findNextChapterUrlMangaDex("Berserk", 150, fakeEnv);
    expect(result).toEqual({ read_url: "https://mangadex.org/chapter/ccc" });
  });

  it("returns a reason when the comic isn't found on MangaDex", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    const result = await findNextChapterUrlMangaDex("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di MangaDex" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stubFetch([chapter("aaa", "5")]);
    const result = await findNextChapterUrlMangaDex("Berserk", 200, fakeEnv);
    expect(result).toEqual({
      read_url: null,
      reason: "Chapter berikutnya tidak ditemukan di MangaDex",
    });
  });

  it("returns a reason when the chapter-list fetch fails", async () => {
    const fn = vi.fn(async (url: string) => {
      if (String(url).includes("/manga?title="))
        return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
      return new Response("error", { status: 500 });
    });
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlMangaDex("Berserk", 1, fakeEnv);
    expect(result).toEqual({
      read_url: null,
      reason: "Gagal mengambil daftar chapter dari MangaDex",
    });
  });
});
