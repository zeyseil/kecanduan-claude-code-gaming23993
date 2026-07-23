import { describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { isChapterSourceId, resolveNextChapter } from "./chapterSources";

vi.mock("./comickChapters", () => ({
  findNextChapterUrl: vi.fn(async () => ({ read_url: "https://comick.dev/x" })),
}));
vi.mock("./mangadexChapters", () => ({
  findNextChapterUrlMangaDex: vi.fn(async () => ({ read_url: "https://mangadex.org/chapter/x" })),
}));
vi.mock("./shinigamiChapters", () => ({
  findNextChapterUrlShinigami: vi.fn(async () => ({ read_url: "https://g.shinigami.asia/chapter/x" })),
}));

const fakeEnv = {} as Env;

describe("isChapterSourceId", () => {
  it("accepts known ids and rejects everything else", () => {
    expect(isChapterSourceId("comick")).toBe(true);
    expect(isChapterSourceId("mangadex")).toBe(true);
    expect(isChapterSourceId("shinigami")).toBe(true);
    expect(isChapterSourceId("anilist")).toBe(false);
    expect(isChapterSourceId(undefined)).toBe(false);
    expect(isChapterSourceId(42)).toBe(false);
  });
});

describe("resolveNextChapter", () => {
  it("dispatches to the comick resolver", async () => {
    const result = await resolveNextChapter("comick", "T", 1, fakeEnv);
    expect(result).toEqual({ read_url: "https://comick.dev/x" });
  });

  it("dispatches to the MangaDex resolver", async () => {
    const result = await resolveNextChapter("mangadex", "T", 1, fakeEnv);
    expect(result).toEqual({ read_url: "https://mangadex.org/chapter/x" });
  });

  it("dispatches to the Shinigami resolver", async () => {
    const result = await resolveNextChapter("shinigami", "T", 1, fakeEnv);
    expect(result).toEqual({ read_url: "https://g.shinigami.asia/chapter/x" });
  });
});
