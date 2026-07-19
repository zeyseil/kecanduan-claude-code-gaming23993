import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { fetchComicInfo } from "./comicInfo";

const fakeEnv = {
  RATE_LIMITER: {
    idFromName: (name: string) => name,
    get: () => ({ fetch: async () => new Response("ok") }),
  },
} as unknown as Env;

interface StubOptions {
  /** MangaDex entries (attributes.title echoes the query when "echo"). */
  mangadex: unknown[] | ((title: string) => unknown[]);
  anilist: unknown[];
}

function mangaDexEntry(title: string, cover: string | null, lang: string | null) {
  return {
    id: "md-1",
    attributes: { title: { en: title }, altTitles: [], originalLanguage: lang },
    relationships: cover ? [{ type: "cover_art", attributes: { fileName: cover } }] : [],
  };
}

function aniListEntry(title: string, cover: string | null, country: string | null) {
  return {
    title: { romaji: title, english: null, native: null },
    synonyms: [],
    countryOfOrigin: country,
    coverImage: cover ? { extraLarge: cover } : {},
  };
}

function stubSources({ mangadex, anilist }: StubOptions) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("api.mangadex.org")) {
        calls.push("mangadex");
        const queried = decodeURIComponent(new URL(u).searchParams.get("title") ?? "");
        const data = typeof mangadex === "function" ? mangadex(queried) : mangadex;
        return new Response(JSON.stringify({ data }), { status: 200 });
      }
      if (u.includes("graphql.anilist.co")) {
        calls.push("anilist");
        return new Response(JSON.stringify({ data: { Page: { media: anilist } } }), {
          status: 200,
        });
      }
      throw new Error(`fetch tak terduga ke ${u}`);
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchComicInfo", () => {
  it("returns MangaDex data without calling AniList when complete", async () => {
    const calls = stubSources({
      mangadex: (t) => [mangaDexEntry(t, "cover.jpg", "ja")],
      anilist: [],
    });

    const info = await fetchComicInfo("Berserk", fakeEnv);
    expect(info).toEqual({
      cover_url: "https://uploads.mangadex.org/covers/md-1/cover.jpg",
      type_tag: "manga",
      source: "mangadex",
    });
    expect(calls).toEqual(["mangadex"]);
  });

  it("falls back to AniList when MangaDex has no match", async () => {
    const calls = stubSources({
      mangadex: [],
      anilist: [aniListEntry("Judul Fallback", "https://s.anilist.co/c.jpg", "KR")],
    });

    const info = await fetchComicInfo("Judul Fallback", fakeEnv);
    expect(info).toEqual({
      cover_url: "https://s.anilist.co/c.jpg",
      type_tag: "manhwa",
      source: "anilist",
    });
    expect(calls).toEqual(["mangadex", "anilist"]);
  });

  it("fills a missing type_tag from AniList when MangaDex found the comic (kasus Unordinary)", async () => {
    const info = await (async () => {
      stubSources({
        // originalLanguage "en" — MangaDex can't map a type.
        mangadex: (t) => [mangaDexEntry(t, "cover.jpg", "en")],
        anilist: [aniListEntry("Unordinary Comic", "https://s.anilist.co/u.jpg", "KR")],
      });
      return fetchComicInfo("Unordinary Comic", fakeEnv);
    })();

    expect(info).toEqual({
      cover_url: "https://uploads.mangadex.org/covers/md-1/cover.jpg",
      type_tag: "manhwa",
      source: "mangadex+anilist",
    });
  });

  it("returns null when both sources miss", async () => {
    stubSources({ mangadex: [], anilist: [] });
    expect(await fetchComicInfo("Tidak Ada Di Mana-mana", fakeEnv)).toBeNull();
  });
});
