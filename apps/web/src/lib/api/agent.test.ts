import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processAgentText } from "./agent";

describe("processAgentText", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /agent/process and returns the parsed response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ session_id: "abc", outputs: [] }), { status: 200 }),
    );

    const result = await processAgentText({ teks_input: "baru baca naruto ch56", google_api_key: "key" });

    expect(result).toEqual({ session_id: "abc", outputs: [] });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("http://localhost:8787/agent/process");
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody).toEqual({ teks_input: "baru baca naruto ch56", google_api_key: "key" });
  });

  it("throws with the server error message when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "google_api_key wajib diisi" }), { status: 400 }),
    );

    await expect(
      processAgentText({ teks_input: "x", google_api_key: "" }),
    ).rejects.toThrow("google_api_key wajib diisi");
  });
});
