import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { fetchKomikuInfo } from "./komiku";

const enabledEnv = { KOMIKU_API_URL: "https://komiku.example.com" } as unknown as Env;

function stub(response: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(response), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchKomikuInfo", () => {
  it("is a no-op (no fetch) when KOMIKU_API_URL is unset", async () => {
    const fn = stub([]);
    expect(await fetchKomikuInfo("Anything", {} as Env)).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a real live response shape (verified against komiku-rest-api.vercel.app)", async () => {
    stub({
      status: true,
      message: "Berhasil mendapatkan hasil pencarian",
      keyword: "solo leveling",
      total: 1,
      data: [
        {
          title: "Solo Leveling",
          altTitle: null,
          slug: "solo-leveling-id",
          href: "/detail-komik/solo-leveling-id/",
          thumbnail: "https://thumbnail.komiku.org/uploads/manga/solo-leveling/thumb.jpg",
          type: "Manhwa",
          genre: "Fantasi",
          description: "Update 1 tahun lalu.",
        },
      ],
    });
    const info = await fetchKomikuInfo("Solo Leveling", enabledEnv);
    expect(info).toEqual({
      cover_url: "https://thumbnail.komiku.org/uploads/manga/solo-leveling/thumb.jpg",
      type_tag: "manhwa",
    });
  });

  it("accepts alternate field names (judul/image/jenis) under data[]", async () => {
    stub({
      data: [{ judul: "Berserk", slug: "berserk", image: "https://cdn/b.jpg", jenis: "Manga Jepang" }],
    });
    const info = await fetchKomikuInfo("Berserk", enabledEnv);
    expect(info).toEqual({ cover_url: "https://cdn/b.jpg", type_tag: "manga" });
  });

  it("ignores the live 'no real match' placeholder entry (empty slug/href, source: generic-parser)", async () => {
    // Observed live: a query with zero real matches still returns total:1 with
    // this exact shape instead of an empty data[].
    stub({
      status: true,
      total: 1,
      data: [{ title: "Manga", slug: "", href: "/detail-komik//", thumbnail: "", source: "generic-parser" }],
    });
    expect(await fetchKomikuInfo("Judul Antah Berantah", enabledEnv)).toBeNull();
  });

  it("returns null when nothing clears the title gate", async () => {
    stub([{ title: "Something Else Entirely", slug: "x", thumbnail: "https://cdn/x.jpg", type: "Manga" }]);
    expect(await fetchKomikuInfo("Naruto", enabledEnv)).toBeNull();
  });

  it("returns null on request failure instead of throwing", async () => {
    stub({}, 502);
    expect(await fetchKomikuInfo("Anything", enabledEnv)).toBeNull();
  });
});
