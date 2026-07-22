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
  /** comick results (top-level array). Defaults to empty = comick misses. */
  comick?: unknown[];
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

function stubSources({ mangadex, comick, anilist }: StubOptions) {
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
      if (u.includes("api.comick.dev")) {
        calls.push("comick");
        return new Response(JSON.stringify(comick ?? []), { status: 200 });
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
    // comick sits between MangaDex and AniList and is always tried (misses here).
    expect(calls).toEqual(["mangadex", "comick", "anilist"]);
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

describe("fetchComicInfo — comick/Komiku fallback", () => {
  const envWithKomiku = {
    ...fakeEnv,
    KOMIKU_API_URL: "https://komiku.example.com",
  } as unknown as Env;

  function stubAll(opts: {
    mangadex?: unknown[];
    comick?: unknown[];
    anilist?: unknown[];
    komiku?: unknown[];
  }) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("api.mangadex.org")) {
          calls.push("mangadex");
          return new Response(JSON.stringify({ data: opts.mangadex ?? [] }), { status: 200 });
        }
        if (u.includes("api.comick.dev")) {
          calls.push("comick");
          return new Response(JSON.stringify(opts.comick ?? []), { status: 200 });
        }
        if (u.includes("graphql.anilist.co")) {
          calls.push("anilist");
          return new Response(JSON.stringify({ data: { Page: { media: opts.anilist ?? [] } } }), { status: 200 });
        }
        if (u.includes("komiku.example.com")) {
          calls.push("komiku");
          return new Response(JSON.stringify(opts.komiku ?? []), { status: 200 });
        }
        throw new Error(`fetch tak terduga ke ${u}`);
      }),
    );
    return calls;
  }

  it("falls through to comick when MangaDex misses, before AniList", async () => {
    const calls = stubAll({
      comick: [{ title: "Local Title", country: "kr", md_covers: [{ b2key: "c.jpg" }] }],
    });
    const info = await fetchComicInfo("Local Title", envWithKomiku);
    expect(info).toEqual({
      cover_url: "https://meo.comick.pictures/c.jpg",
      type_tag: "manhwa",
      source: "comick",
    });
    // AniList & Komiku never reached — comick already completed the result.
    expect(calls).toEqual(["mangadex", "comick"]);
  });

  it("reaches Komiku only when every earlier source misses", async () => {
    const calls = stubAll({
      komiku: [{ title: "Komik Lokal", slug: "komik-lokal", thumbnail: "https://cdn/k.jpg", type: "Manhua" }],
    });
    const info = await fetchComicInfo("Komik Lokal", envWithKomiku);
    expect(info).toEqual({ cover_url: "https://cdn/k.jpg", type_tag: "manhua", source: "komiku" });
    expect(calls).toEqual(["mangadex", "comick", "anilist", "komiku"]);
  });
});
