import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";

// @cloudflare/puppeteer is the first browser-driven dependency in this
// codebase — every other source mocks global fetch, but Komikcast goes
// through a real (mocked-here) headless page instead. `evaluateQueue` holds
// canned return values, consumed in call order: first evaluate() is the
// search page, second is the chapter-detail page — mirroring the two
// withBrowserPage() calls in findNextChapterUrlKomikcast. `gotoFailAt` is the
// 1-indexed overall goto() call number (across both phases) that should throw,
// or null to never throw. vi.mock() calls are hoisted above imports by
// vitest, so this runs before the static import below.
const state: {
  gotoUrls: string[];
  evaluateQueue: unknown[];
  gotoFailAt: number | null;
} = { gotoUrls: [], evaluateQueue: [], gotoFailAt: null };

vi.mock("@cloudflare/puppeteer", () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        goto: vi.fn(async (url: string) => {
          state.gotoUrls.push(url);
          if (state.gotoFailAt !== null && state.gotoUrls.length === state.gotoFailAt) {
            throw new Error("navigation failed");
          }
          return null;
        }),
        evaluate: vi.fn(async () => state.evaluateQueue.shift()),
      })),
      close: vi.fn(async () => {}),
    })),
  },
}));

import { findNextChapterUrlKomikcast } from "./komikcastChapters";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
  BROWSER: {} as Env["BROWSER"],
} as unknown as Env;

beforeEach(() => {
  state.gotoUrls = [];
  state.evaluateQueue = [];
  state.gotoFailAt = null;
});

afterEach(() => vi.clearAllMocks());

const SOLO_LEVELING_SEARCH = [{ title: "Solo Leveling", slug: "solo-leveling" }];

describe("findNextChapterUrlKomikcast", () => {
  it("finds the closest chapter above afterChapter (argmin over an unsorted list)", async () => {
    state.evaluateQueue = [
      SOLO_LEVELING_SEARCH,
      [
        { chapterNumber: 178, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-178/" },
        { chapterNumber: 180, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-180/" },
        { chapterNumber: 179, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-179/" },
      ],
    ];
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 178, fakeEnv);
    expect(result).toEqual({ read_url: "https://v3.komikcast.fit/komik/solo-leveling/chapter-179/" });
  });

  it("handles a chapter number containing a decimal point", async () => {
    state.evaluateQueue = [
      SOLO_LEVELING_SEARCH,
      [
        { chapterNumber: 179, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-179/" },
        { chapterNumber: 179.6, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-179-6/" },
      ],
    ];
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 179, fakeEnv);
    expect(result).toEqual({ read_url: "https://v3.komikcast.fit/komik/solo-leveling/chapter-179-6/" });
  });

  it("returns a reason when search finds no result", async () => {
    state.evaluateQueue = [[]];
    const result = await findNextChapterUrlKomikcast("Totally Unknown Thing", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when search finds results but none pass the title gate", async () => {
    state.evaluateQueue = [[{ title: "Completely Different Manga", slug: "cdm" }]];
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when the search page navigation fails", async () => {
    state.gotoFailAt = 1;
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Komik tidak ditemukan di Komikcast" });
  });

  it("returns a reason when the detail page navigation fails after a successful search", async () => {
    state.evaluateQueue = [SOLO_LEVELING_SEARCH];
    state.gotoFailAt = 2; // search goto (#1) succeeds, detail goto (#2) fails
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 1, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Gagal mengambil daftar chapter dari Komikcast" });
  });

  it("returns a reason when no chapter is greater than afterChapter", async () => {
    state.evaluateQueue = [
      SOLO_LEVELING_SEARCH,
      [{ chapterNumber: 5, href: "https://v3.komikcast.fit/komik/solo-leveling/chapter-5/" }],
    ];
    const result = await findNextChapterUrlKomikcast("Solo Leveling", 200, fakeEnv);
    expect(result).toEqual({ read_url: null, reason: "Chapter berikutnya tidak ditemukan di Komikcast" });
  });
});
