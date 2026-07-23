import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrlShinigami } from "./shinigamiChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const SEARCH_RESULT = {
  data: [{ manga_id: "5c612573", title: "Solo Leveling", alternative_title: "Na Honjaman Level Up" }],
};

function stubFetch(chaptersPage1: unknown[], chaptersPage2?: unknown[]) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/v1/manga/list")) {
      return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
    }
    if (u.includes("/v1/chapter/")) {
      const page = new URL(u).searchParams.get("page");
      const data = page === "2" ? (chaptersPage2 ?? []) : chaptersPage1;
      return new Response(JSON.stringify({ data }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrlShinigami", () => {
  it("finds the closest chapter above afterChapter and builds a reader URL", async () => {
    stubFetch([
      { chapter_id: "aaa", chapter_number: 202 },
      { chapter_id: "bbb", chapter_number: 201 },
      { chapter_id: "ccc", chapter_number: 200 },
      { chapter_id: "ddd", chapter_number: 199 },
    ]);
    const result = await findNextChapterUrlShinigami("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: "https://g.shinigami.asia/chapter/bbb" });
  });

  it("pages forward when the boundary chapter isn't on the first page", async () => {
    stubFetch(
      [
        { chapter_id: "aaa", chapter_number: 205 },
        { chapter_id: "bbb", chapter_number: 204 },
      ],
      [
        { chapter_id: "ccc", chapter_number: 203 },
        { chapter_id: "ddd", chapter_number: 100 },
      ],
    );
    const result = await findNextChapterUrlShinigami("Solo Leveling", 150, fakeEnv);
    expect(result).toEqual({ read_url: "https://g.shinigami.asia/chapter/ccc" });
  });

  it("returns a reason when the comic isn't found on Shinigami", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    const result = await findNextChapterUrlShinigami("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Shinigami" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stubFetch([{ chapter_id: "aaa", chapter_number: 5 }]);
    const result = await findNextChapterUrlShinigami("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di Shinigami" });
  });

  it("returns a reason when the chapter-list fetch fails", async () => {
    const fn = vi.fn(async (url: string) => {
      if (String(url).includes("/v1/manga/list")) return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
      return new Response("error", { status: 500 });
    });
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlShinigami("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari Shinigami" });
  });

  it("calls the Shinigami chapter-list endpoint for the matched manga_id", async () => {
    const fn = stubFetch([{ chapter_id: "ccc", chapter_number: 5 }]);
    await findNextChapterUrlShinigami("Solo Leveling", 1, fakeEnv);
    const calls = fn.mock.calls as unknown as Array<[string]>;
    const chapterCall = calls.find((call) => call[0].includes("/v1/chapter/"));
    expect(chapterCall?.[0]).toContain("/v1/chapter/5c612573/list");
  });
});
