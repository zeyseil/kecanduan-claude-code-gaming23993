import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrl } from "./comickChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const SEARCH_RESULT = [
  { hid: "71gMd0vF", slug: "00-solo-leveling", title: "Solo Leveling", country: "kr", md_titles: [], md_covers: [] },
];

function stubFetch(chaptersPage1: unknown[], chaptersPage2?: unknown[]) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/v1.0/search/")) {
      return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
    }
    if (u.includes("/chapters")) {
      const page = new URL(u).searchParams.get("page");
      const chapters = page === "2" ? (chaptersPage2 ?? []) : chaptersPage1;
      return new Response(JSON.stringify({ chapters, total: chapters.length }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrl", () => {
  it("finds the closest chapter above afterChapter and builds a comick.dev reader URL", async () => {
    stubFetch([
      { hid: "aaa", chap: "202", lang: "en" },
      { hid: "bbb", chap: "201", lang: "en" },
      { hid: "ccc", chap: "200", lang: "en" },
      { hid: "ddd", chap: "199", lang: "en" },
    ]);
    const result = await findNextChapterUrl("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: "https://comick.dev/comic/00-solo-leveling/bbb-chapter-201-en" });
  });

  it("pages forward when the boundary chapter isn't on the first page", async () => {
    stubFetch(
      [
        { hid: "aaa", chap: "205", lang: "en" },
        { hid: "bbb", chap: "204", lang: "en" },
      ],
      [
        { hid: "ccc", chap: "203", lang: "en" },
        { hid: "ddd", chap: "100", lang: "en" },
      ],
    );
    const result = await findNextChapterUrl("Solo Leveling", 150, fakeEnv);
    expect(result).toEqual({ read_url: "https://comick.dev/comic/00-solo-leveling/ccc-chapter-203-en" });
  });

  it("returns a reason when the comic isn't found on comick", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );
    const result = await findNextChapterUrl("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di comick.dev" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stubFetch([{ hid: "aaa", chap: "5", lang: "en" }]);
    const result = await findNextChapterUrl("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di comick.dev" });
  });

  it("returns a reason when the chapter-list fetch fails", async () => {
    const fn = vi.fn(async (url: string) => {
      if (String(url).includes("/v1.0/search/")) return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
      return new Response("error", { status: 500 });
    });
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrl("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari comick.dev" });
  });

  it("sends the browser User-Agent on the chapter-list request", async () => {
    const fn = stubFetch([{ hid: "ccc", chap: "5", lang: "en" }]);
    await findNextChapterUrl("Solo Leveling", 1, fakeEnv);
    const calls = fn.mock.calls as unknown as Array<[string, RequestInit?]>;
    const chapterCall = calls.find((call) => call[0].includes("/chapters"));
    expect((chapterCall?.[1]?.headers as Record<string, string>)["User-Agent"]).toMatch(/Mozilla/);
  });
});
