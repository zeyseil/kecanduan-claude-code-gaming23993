import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMangaDexInfo, pickBestMatch } from "./mangadex";

// Response shapes below mirror what the live MangaDex API actually returns,
// observed while planning this feature — including the fact that a title search
// frequently ranks an unrelated work first.

function mangaEntry(opts: {
  id: string;
  title?: Record<string, string>;
  altTitles?: Array<Record<string, string>>;
  originalLanguage?: string;
  coverFile?: string;
}) {
  return {
    id: opts.id,
    attributes: {
      title: opts.title ?? {},
      altTitles: opts.altTitles ?? [],
      originalLanguage: opts.originalLanguage,
    },
    relationships: opts.coverFile
      ? [{ type: "cover_art", attributes: { fileName: opts.coverFile } }]
      : [],
  };
}

function stubMangaDex(data: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data }), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pickBestMatch", () => {
  it("picks the real match over unrelated results ranked first (the Naruto case)", () => {
    // Live API order for query "Naruto": unrelated first, doujinshi second,
    // the real series third. data[0] would be wrong.
    const entries = [
      mangaEntry({ id: "renge", title: { ja: "Renge to Naruto!" }, originalLanguage: "ja" }),
      mangaEntry({
        id: "doujin",
        title: { en: "Uzumaki : Illegitimate" },
        altTitles: [{ en: "Naruto: Daughter" }],
        originalLanguage: "en",
      }),
      mangaEntry({ id: "real", title: { ja: "Naruto" }, originalLanguage: "ja" }),
    ];
    expect(pickBestMatch(entries, "Naruto")?.id).toBe("real");
  });

  it("matches via altTitles when the canonical title is a different language", () => {
    // Solo Leveling's primary title is romanised Korean; the typed string is an altTitle.
    const entries = [
      mangaEntry({
        id: "solo",
        title: { "ko-ro": "Na Honjaman Level-Up" },
        altTitles: [{ en: "Solo Leveling" }, { en: "Only I Level up" }],
        originalLanguage: "ko",
      }),
    ];
    expect(pickBestMatch(entries, "Solo Leveling")?.id).toBe("solo");
  });

  it("returns null when nothing clears the similarity threshold", () => {
    const entries = [
      mangaEntry({ id: "x", title: { en: "Completely Different Series" }, originalLanguage: "ja" }),
    ];
    expect(pickBestMatch(entries, "Naruto")).toBeNull();
  });
});

describe("fetchMangaDexInfo", () => {
  it("maps originalLanguage to type_tag (ko -> manhwa) and builds the cover URL", async () => {
    stubMangaDex([
      mangaEntry({
        id: "solo",
        title: { "ko-ro": "Na Honjaman Level-Up" },
        altTitles: [{ en: "Solo Leveling" }],
        originalLanguage: "ko",
        coverFile: "cover.jpg",
      }),
    ]);
    const info = await fetchMangaDexInfo("Solo Leveling");
    expect(info).toEqual({
      cover_url: "https://uploads.mangadex.org/covers/solo/cover.jpg",
      type_tag: "manhwa",
    });
  });

  it("maps ja -> manga and zh -> manhua", async () => {
    stubMangaDex([mangaEntry({ id: "n", title: { ja: "Naruto" }, originalLanguage: "ja" })]);
    expect((await fetchMangaDexInfo("Naruto"))?.type_tag).toBe("manga");

    stubMangaDex([mangaEntry({ id: "z", title: { en: "Some Manhua" }, originalLanguage: "zh" })]);
    expect((await fetchMangaDexInfo("Some Manhua"))?.type_tag).toBe("manhua");
  });

  it("returns type_tag null for an unmapped language, not a guess", async () => {
    stubMangaDex([
      mangaEntry({ id: "en", title: { en: "English Webcomic" }, originalLanguage: "en" }),
    ]);
    const info = await fetchMangaDexInfo("English Webcomic");
    expect(info?.type_tag).toBeNull();
  });

  it("returns null when there is no confident title match", async () => {
    stubMangaDex([
      mangaEntry({ id: "x", title: { en: "Totally Unrelated" }, originalLanguage: "ja" }),
    ]);
    expect(await fetchMangaDexInfo("Naruto")).toBeNull();
  });

  it("returns null when MangaDex returns no results", async () => {
    stubMangaDex([]);
    expect(await fetchMangaDexInfo("Judul Antah Berantah")).toBeNull();
  });
});
