import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { fetchComixInfo } from "./comix";

const enabledEnv = { COMIX_API_URL: "https://comix.example.com" } as unknown as Env;

function stub(response: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(response), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchComixInfo", () => {
  it("is a no-op (no fetch) when COMIX_API_URL is unset", async () => {
    const fn = stub({});
    const info = await fetchComixInfo("Anything", {} as Env);
    expect(info).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("maps a matching result to cover_url + type_tag, prefixing a relative img", async () => {
    stub({ data: [{ id: "1", title: "Solo Leveling", img: "/api/image?url=x", type: "manhwa" }] });
    const info = await fetchComixInfo("Solo Leveling", enabledEnv);
    expect(info).toEqual({
      cover_url: "https://comix.example.com/api/image?url=x",
      type_tag: "manhwa",
    });
  });

  it("keeps an absolute img URL as-is and returns null type for unknown type", async () => {
    stub({ results: [{ id: "1", title: "Berserk", img: "https://cdn/x.jpg", type: "weird" }] });
    const info = await fetchComixInfo("Berserk", enabledEnv);
    expect(info).toEqual({ cover_url: "https://cdn/x.jpg", type_tag: null });
  });

  it("returns null when nothing clears the title gate", async () => {
    stub({ data: [{ id: "1", title: "Totally Unrelated Thing", img: "/x", type: "manga" }] });
    expect(await fetchComixInfo("Naruto", enabledEnv)).toBeNull();
  });

  it("returns null on a non-OK response instead of throwing", async () => {
    stub({}, 500);
    expect(await fetchComixInfo("Anything", enabledEnv)).toBeNull();
  });
});
