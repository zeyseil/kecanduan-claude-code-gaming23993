import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import { searchKiryuuMatch } from "./kiryuu";

const enabledEnv = {} as Env; // Kiryuu has no env-gate — always enabled

const NONCE_HTML = `<input type='hidden' name='search_nonce' value='2be9814f9d'>`;

// Trimmed version of the real live AJAX search response shape.
const SEARCH_HTML = `
<div id="searchResults" class="flex flex-col gap-2">
  <a href="https://v7.kiryuu.to/manga/martial-peak/" class="flex items-center gap-4">
    <img src="https://v7.kiryuu.to/wp-content/uploads/Martial-Peak.jpg" alt="Martial Peak">
    <div><h3 class="text-lg font-semibold line-clamp-2">Martial Peak</h3><p>desc</p></div>
  </a>
  <a href="https://v7.kiryuu.to/manga/solo-leveling/" class="flex items-center gap-4">
    <img src="https://v7.kiryuu.to/wp-content/uploads/Solo-Leveling.jpg" alt="Solo Leveling">
    <div><h3 class="text-lg font-semibold line-clamp-2">Solo Leveling</h3><p>desc</p></div>
  </a>
</div>`;

function stub(nonceHtml: string | null, searchHtml: string | null, searchStatus = 200) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("action=get_nonce")) {
      return nonceHtml === null
        ? new Response("error", { status: 500 })
        : new Response(nonceHtml, { status: 200 });
    }
    if (u.includes("action=search")) {
      expect(init?.method).toBe("POST");
      return searchHtml === null
        ? new Response("error", { status: searchStatus })
        : new Response(searchHtml, { status: searchStatus });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("searchKiryuuMatch", () => {
  it("fetches a nonce then finds the best-matching card by title", async () => {
    stub(NONCE_HTML, SEARCH_HTML);
    const match = await searchKiryuuMatch("Solo Leveling", enabledEnv);
    expect(match).toEqual({ title: "Solo Leveling", url: "https://v7.kiryuu.to/manga/solo-leveling/" });
  });

  it("sends the nonce and search term on the POST request", async () => {
    const fn = stub(NONCE_HTML, SEARCH_HTML);
    await searchKiryuuMatch("Solo Leveling", enabledEnv);
    const calls = fn.mock.calls as unknown as Array<[string, RequestInit?]>;
    const searchCall = calls.find((c) => c[0].includes("action=search"));
    expect(searchCall?.[0]).toContain("nonce=2be9814f9d");
    expect(searchCall?.[1]?.body).toBe("search_term=Solo%20Leveling");
  });

  it("returns null when the nonce request fails", async () => {
    stub(null, SEARCH_HTML);
    expect(await searchKiryuuMatch("Solo Leveling", enabledEnv)).toBeNull();
  });

  it("returns null when the search request fails", async () => {
    stub(NONCE_HTML, null, 500);
    expect(await searchKiryuuMatch("Solo Leveling", enabledEnv)).toBeNull();
  });

  it("returns null when nothing clears the title gate", async () => {
    stub(NONCE_HTML, SEARCH_HTML);
    expect(await searchKiryuuMatch("Totally Unknown Thing", enabledEnv)).toBeNull();
  });

  it("returns null when the search response has no result cards", async () => {
    stub(NONCE_HTML, `<div id="searchResults"></div>`);
    expect(await searchKiryuuMatch("Solo Leveling", enabledEnv)).toBeNull();
  });
});
