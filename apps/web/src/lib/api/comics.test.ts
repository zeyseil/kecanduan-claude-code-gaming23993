import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchComics, postComic } from "./comics";
import type { Comic } from "../../types/comic";

const SAMPLE: Comic = {
  comic_id: "1",
  title: "One Piece",
  aliases: [],
  type_tag: "manga",
  is_adult: false,
  latest_chapter: 1,
  status: "ongoing",
  cover_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchComics", () => {
  it("mengembalikan list comic saat response ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([SAMPLE]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchComics();

    expect(result).toEqual([SAMPLE]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/comics");
  });

  it("throw dengan pesan error dari body saat response gagal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "server meledak" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchComics()).rejects.toThrow("server meledak");
  });

  it("throw dengan pesan default kalau body tidak punya field error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error("not json")),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchComics()).rejects.toThrow("Request gagal (503)");
  });
});

describe("postComic", () => {
  it("mengirim POST dengan body JSON dan mengembalikan comic yang dibuat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await postComic({
      title: "One Piece",
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 1,
      cover_url: null,
    });

    expect(result).toEqual(SAMPLE);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const [, requestInit] = fetchMock.mock.calls[0];
    expect(JSON.parse(requestInit.body as string).status).toBe("ongoing");
  });

  it("throw saat response gagal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "title wajib diisi" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postComic({
        title: "",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        cover_url: null,
      }),
    ).rejects.toThrow("title wajib diisi");
  });
});
