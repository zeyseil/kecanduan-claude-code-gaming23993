import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAniListInfo } from "./anilist";

function stubAniList(media: unknown[], status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: { Page: { media } } }), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAniListInfo", () => {
  it("returns cover + type mapped from countryOfOrigin (KR -> manhwa)", async () => {
    stubAniList([
      {
        title: { romaji: "Na Honjaman Level Up", english: "Solo Leveling", native: null },
        synonyms: [],
        countryOfOrigin: "KR",
        coverImage: { extraLarge: "https://s.anilist.co/cover-xl.jpg", large: "https://s.anilist.co/cover-l.jpg" },
      },
    ]);

    const info = await fetchAniListInfo("Solo Leveling");
    expect(info).toEqual({ cover_url: "https://s.anilist.co/cover-xl.jpg", type_tag: "manhwa" });
  });

  it("matches via synonyms, not just primary titles", async () => {
    stubAniList([
      {
        title: { romaji: "Judul Resmi Panjang Sekali", english: null, native: null },
        synonyms: ["The World After the Fall"],
        countryOfOrigin: "KR",
        coverImage: { large: "https://s.anilist.co/cover.jpg" },
      },
    ]);

    const info = await fetchAniListInfo("The world after the fall");
    expect(info?.cover_url).toBe("https://s.anilist.co/cover.jpg");
    expect(info?.type_tag).toBe("manhwa");
  });

  it("returns null when no candidate passes the title gate", async () => {
    stubAniList([
      {
        title: { romaji: "Komik Lain Sama Sekali", english: null, native: null },
        synonyms: [],
        countryOfOrigin: "JP",
        coverImage: { large: "https://s.anilist.co/x.jpg" },
      },
    ]);

    expect(await fetchAniListInfo("Naruto")).toBeNull();
  });

  it("returns null type_tag for an unmapped country instead of guessing", async () => {
    stubAniList([
      {
        title: { romaji: "Webtoon Inggris", english: "Webtoon Inggris", native: null },
        synonyms: [],
        countryOfOrigin: "US",
        coverImage: { large: "https://s.anilist.co/us.jpg" },
      },
    ]);

    const info = await fetchAniListInfo("Webtoon Inggris");
    expect(info?.type_tag).toBeNull();
    expect(info?.cover_url).toBe("https://s.anilist.co/us.jpg");
  });

  it("returns null on a failed request instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    expect(await fetchAniListInfo("Apa Saja")).toBeNull();
  });
});
