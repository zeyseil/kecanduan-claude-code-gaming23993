import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { fetchComickInfo } from "./comick";

// No COMICK_API_URL override → default host api.comick.dev.
const env = {} as Env;

function stub(response: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(response), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchComickInfo", () => {
  it("maps a match to cover_url (from b2key) + type_tag (from country), hitting the default host with a browser UA", async () => {
    const fn = stub([
      { hid: "x1", title: "Solo Leveling", country: "kr", md_titles: [], md_covers: [{ b2key: "abc.jpg" }] },
    ]);
    const info = await fetchComickInfo("Solo Leveling", env);
    expect(info).toEqual({ cover_url: "https://meo.comick.pictures/abc.jpg", type_tag: "manhwa" });

    const [url, init] = fn.mock.calls[0];
    expect(String(url)).toContain("api.comick.dev/v1.0/search/");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/Mozilla/);
  });

  it("maps country jp→manga and cn→manhua", async () => {
    stub([{ title: "Berserk", country: "jp", md_covers: [{ b2key: "b.jpg" }] }]);
    expect(await fetchComickInfo("Berserk", env)).toEqual({
      cover_url: "https://meo.comick.pictures/b.jpg",
      type_tag: "manga",
    });
    stub([{ title: "Tales of Demons and Gods", country: "cn", md_covers: [{ b2key: "c.jpg" }] }]);
    expect(await fetchComickInfo("Tales of Demons and Gods", env)).toEqual({
      cover_url: "https://meo.comick.pictures/c.jpg",
      type_tag: "manhua",
    });
  });

  it("matches via an alt title in md_titles, and returns null type for an unmapped country", async () => {
    stub([
      {
        title: "노 홈리스",
        country: "xx",
        md_titles: [{ title: "The Unmapped Title" }],
        md_covers: [{ b2key: "d.jpg" }],
      },
    ]);
    expect(await fetchComickInfo("The Unmapped Title", env)).toEqual({
      cover_url: "https://meo.comick.pictures/d.jpg",
      type_tag: null,
    });
  });

  it("returns null cover when md_covers is missing/empty (still resolves type)", async () => {
    stub([{ title: "No Cover Comic", country: "kr", md_covers: [] }]);
    expect(await fetchComickInfo("No Cover Comic", env)).toEqual({ cover_url: null, type_tag: "manhwa" });
  });

  it("returns null when nothing clears the title gate", async () => {
    stub([{ title: "Totally Unrelated Thing", country: "jp", md_covers: [{ b2key: "x" }] }]);
    expect(await fetchComickInfo("Naruto", env)).toBeNull();
  });

  it("returns null when the response is not a top-level array (defensive)", async () => {
    stub({ data: [{ title: "Naruto", country: "jp", md_covers: [{ b2key: "x" }] }] });
    expect(await fetchComickInfo("Naruto", env)).toBeNull();
  });

  it("returns null on a non-OK response instead of throwing", async () => {
    stub([], 500);
    expect(await fetchComickInfo("Anything", env)).toBeNull();
  });

  it("respects a COMICK_API_URL override", async () => {
    const fn = stub([{ title: "X", country: "kr", md_covers: [{ b2key: "o.jpg" }] }]);
    await fetchComickInfo("X", { COMICK_API_URL: "https://my-proxy.example.com/" } as Env);
    expect(String(fn.mock.calls[0][0])).toContain("https://my-proxy.example.com/v1.0/search/");
  });
});
