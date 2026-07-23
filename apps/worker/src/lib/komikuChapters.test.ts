import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrlKomiku } from "./komikuChapters";

const enabledEnv = {
  KOMIKU_API_URL: "https://komiku.example.com",
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const SEARCH_RESULT = {
  data: [{ title: "Solo Leveling", slug: "solo-leveling-id", href: "/detail-komik/solo-leveling-id/" }],
};

function stubFetch(chapters: unknown[]) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/search")) {
      return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
    }
    if (u.includes("/detail-komik/")) {
      return new Response(JSON.stringify({ chapters }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrlKomiku", () => {
  it("returns a reason (no fetch) when KOMIKU_API_URL is unset", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlKomiku("Anything", 1, {} as Env);
    expect(result).toEqual({
      read_url: null,
      reason: "Komiku belum dikonfigurasi (perlu KOMIKU_API_URL)",
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("finds the closest chapter above afterChapter and returns its original URL", async () => {
    stubFetch([
      { chapterNumber: 180, originalLink: "https://komiku.org/solo-leveling-chapter-180/" },
      { chapterNumber: 179, originalLink: "https://komiku.org/solo-leveling-chapter-179/" },
      { chapterNumber: 178, originalLink: "https://komiku.org/solo-leveling-chapter-178/" },
    ]);
    const result = await findNextChapterUrlKomiku("Solo Leveling", 178, enabledEnv);
    expect(result).toEqual({ read_url: "https://komiku.org/solo-leveling-chapter-179/" });
  });

  it("returns a reason when the comic isn't found on Komiku", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    );
    const result = await findNextChapterUrlKomiku("Totally Unknown Thing", 1, enabledEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komiku" });
  });

  it("returns a reason when the detail fetch fails", async () => {
    const fn = vi.fn(async (url: string) => {
      if (String(url).includes("/search")) return new Response(JSON.stringify(SEARCH_RESULT), { status: 200 });
      return new Response("error", { status: 500 });
    });
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlKomiku("Solo Leveling", 1, enabledEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari Komiku" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stubFetch([{ chapterNumber: 5, originalLink: "https://komiku.org/solo-leveling-chapter-5/" }]);
    const result = await findNextChapterUrlKomiku("Solo Leveling", 200, enabledEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komiku" });
  });

  it("returns a reason when the matched chapter is missing originalLink", async () => {
    stubFetch([{ chapterNumber: 180 }]);
    const result = await findNextChapterUrlKomiku("Solo Leveling", 1, enabledEnv);
    expect(result).toEqual({
      read_url: null,
      reason: "Chapter berikutnya ditemukan tapi datanya tidak lengkap",
    });
  });
});
