import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteComic, fetchComics, patchComic, postComic } from "./comics";
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
  read_url: null,
  release_day: null,
  note: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  const storage = fakeLocalStorage();
  storage.setItem("komik-tracker:auth-token", "test-token");
  vi.stubGlobal("localStorage", storage);
});

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
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics",
      expect.objectContaining({ headers: { Authorization: "Bearer test-token" } }),
    );
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
      read_url: null,
      release_day: null,
      note: null,
    });

    expect(result).toEqual(SAMPLE);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
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
        read_url: null,
        release_day: null,
        note: null,
      }),
    ).rejects.toThrow("title wajib diisi");
  });
});

describe("patchComic", () => {
  it("mengirim PATCH ke /comics/:id dengan body benar dan mengembalikan comic yang diupdate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...SAMPLE, latest_chapter: 5 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await patchComic("1", { latest_chapter: 5 });

    expect(result.latest_chapter).toBe(5);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics/1",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ latest_chapter: 5 }),
      }),
    );
  });

  it("throw dengan pesan error dari body saat response gagal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "comic tidak ditemukan" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(patchComic("missing", { latest_chapter: 5 })).rejects.toThrow(
      "comic tidak ditemukan",
    );
  });
});

describe("deleteComic", () => {
  it("mengirim DELETE ke /comics/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteComic("1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/comics/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throw dengan pesan error dari body saat response gagal", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "comic tidak ditemukan" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteComic("missing")).rejects.toThrow("comic tidak ditemukan");
  });
});
