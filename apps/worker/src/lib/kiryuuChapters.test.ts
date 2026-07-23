import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { findNextChapterUrlKiryuu } from "./kiryuuChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

const NONCE_HTML = `<input type='hidden' name='search_nonce' value='2be9814f9d'>`;
const SEARCH_HTML = `
<a href="https://v7.kiryuu.to/manga/solo-leveling/" class="flex">
  <img src="x"><div><h3 class="text-lg">Solo Leveling</h3></div>
</a>`;

/** Detail-page HTML mirroring the real live shape: a stray "start reading"
 * quick-link to chapter 0 appears BEFORE the real descending chapter list —
 * this is exactly the noise findNextChapterUrlKiryuu must not be fooled by. */
function detailHtmlWithNoise(realChapters: Array<{ num: string; postId: string }>): string {
  const strayQuickLink = `<a href="https://v7.kiryuu.to/manga/solo-leveling/chapter-0.147843/">Chapter 0</a>`;
  const list = realChapters
    .map((c) => `<a href="https://v7.kiryuu.to/manga/solo-leveling/chapter-${c.num}.${c.postId}/">Chapter ${c.num}</a>`)
    .join("\n");
  return `<div>${strayQuickLink}</div><div>${list}</div>`;
}

function stub(searchHtml: string, detailHtml: string) {
  const fn = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("action=get_nonce")) return new Response(NONCE_HTML, { status: 200 });
    if (u.includes("action=search")) return new Response(searchHtml, { status: 200 });
    if (u.includes("/manga/solo-leveling/")) return new Response(detailHtml, { status: 200 });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("findNextChapterUrlKiryuu", () => {
  it("finds the closest chapter above afterChapter, ignoring the stray low quick-link", async () => {
    stub(
      SEARCH_HTML,
      detailHtmlWithNoise([
        { num: "180", postId: "153000" },
        { num: "179", postId: "152950" },
        { num: "178", postId: "152900" },
      ]),
    );
    const result = await findNextChapterUrlKiryuu("Solo Leveling", 178, fakeEnv);
    expect(result).toEqual({ read_url: "https://v7.kiryuu.to/manga/solo-leveling/chapter-179.152950/" });
  });

  it("parses a chapter number that itself contains a decimal point (179.6)", async () => {
    stub(
      SEARCH_HTML,
      detailHtmlWithNoise([
        { num: "179.6", postId: "425255" },
        { num: "179", postId: "152950" },
      ]),
    );
    const result = await findNextChapterUrlKiryuu("Solo Leveling", 179, fakeEnv);
    expect(result).toEqual({ read_url: "https://v7.kiryuu.to/manga/solo-leveling/chapter-179.6.425255/" });
  });

  it("does not stop early on the stray 'Chapter 0' quick-link when afterChapter is low", async () => {
    // The stray quick-link (chapter 0.147843) must not be picked as "the
    // closest chapter above afterChapter=0" ahead of real chapter 1 further down.
    stub(SEARCH_HTML, detailHtmlWithNoise([{ num: "1", postId: "147943" }]));
    const result = await findNextChapterUrlKiryuu("Solo Leveling", 0, fakeEnv);
    expect(result).toEqual({ read_url: "https://v7.kiryuu.to/manga/solo-leveling/chapter-1.147943/" });
  });

  it("returns a reason when the comic isn't found on Kiryuu", async () => {
    stub(`<div id="searchResults"></div>`, "");
    const result = await findNextChapterUrlKiryuu("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Kiryuu" });
  });

  it("returns a reason when the detail page fetch fails", async () => {
    const fn = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("action=get_nonce")) return new Response(NONCE_HTML, { status: 200 });
      if (u.includes("action=search")) return new Response(SEARCH_HTML, { status: 200 });
      return new Response("error", { status: 500 });
    });
    vi.stubGlobal("fetch", fn);
    const result = await findNextChapterUrlKiryuu("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari Kiryuu" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    stub(SEARCH_HTML, detailHtmlWithNoise([{ num: "5", postId: "148485" }]));
    const result = await findNextChapterUrlKiryuu("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di Kiryuu" });
  });
});
