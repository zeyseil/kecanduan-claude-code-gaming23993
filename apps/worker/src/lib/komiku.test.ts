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

  it("maps a top-level array with thumbnail + type fields", async () => {
    stub([{ title: "Solo Leveling", thumbnail: "https://cdn/s.jpg", type: "Manhwa" }]);
    const info = await fetchKomikuInfo("Solo Leveling", enabledEnv);
    expect(info).toEqual({ cover_url: "https://cdn/s.jpg", type_tag: "manhwa" });
  });

  it("accepts alternate field names (judul/image/jenis) under data[]", async () => {
    stub({ data: [{ judul: "Berserk", image: "https://cdn/b.jpg", jenis: "Manga Jepang" }] });
    const info = await fetchKomikuInfo("Berserk", enabledEnv);
    expect(info).toEqual({ cover_url: "https://cdn/b.jpg", type_tag: "manga" });
  });

  it("returns null when nothing clears the title gate", async () => {
    stub([{ title: "Something Else Entirely", thumbnail: "https://cdn/x.jpg", type: "Manga" }]);
    expect(await fetchKomikuInfo("Naruto", enabledEnv)).toBeNull();
  });

  it("returns null on request failure instead of throwing", async () => {
    stub({}, 502);
    expect(await fetchKomikuInfo("Anything", enabledEnv)).toBeNull();
  });
});
