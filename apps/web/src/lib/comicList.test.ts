import { describe, it, expect } from "vitest";
import { selectComics, selectRecent, DEFAULT_OPTIONS } from "./comicList";
import type { Comic } from "../types/comic";

function comic(overrides: Partial<Comic>): Comic {
  return {
    comic_id: "id",
    title: "Untitled",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 1,
    status: "ongoing",
    cover_url: null,
    read_url: null,
    release_day: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const sample: Comic[] = [
  comic({
    comic_id: "a",
    title: "Berserk",
    type_tag: "manga",
    status: "ongoing",
    updated_at: "2026-01-01T00:00:00.000Z",
  }),
  comic({
    comic_id: "b",
    title: "Solo Leveling",
    aliases: ["Na Honjaman Level Up"],
    type_tag: "manhwa",
    status: "completed",
    updated_at: "2026-03-01T00:00:00.000Z",
  }),
  comic({
    comic_id: "c",
    title: "Martial Peak",
    type_tag: "manhua",
    status: "ongoing",
    updated_at: "2026-02-01T00:00:00.000Z",
  }),
];

describe("selectComics", () => {
  it("mengembalikan semua komik dengan opsi default", () => {
    expect(selectComics(sample, DEFAULT_OPTIONS)).toHaveLength(3);
  });

  it("tidak memutasi array input", () => {
    const copy = [...sample];
    selectComics(sample, { ...DEFAULT_OPTIONS, sort: "alpha" });
    expect(sample).toEqual(copy);
  });

  it("search mencocokkan judul secara case-insensitive", () => {
    const result = selectComics(sample, { ...DEFAULT_OPTIONS, search: "solo" });
    expect(result.map((c) => c.comic_id)).toEqual(["b"]);
  });

  it("search juga mencocokkan alias", () => {
    const result = selectComics(sample, {
      ...DEFAULT_OPTIONS,
      search: "honjaman",
    });
    expect(result.map((c) => c.comic_id)).toEqual(["b"]);
  });

  it("filter jenis menyaring per type_tag", () => {
    const result = selectComics(sample, {
      ...DEFAULT_OPTIONS,
      typeFilter: "manhua",
    });
    expect(result.map((c) => c.comic_id)).toEqual(["c"]);
  });

  it("filter status menyaring ongoing/completed", () => {
    const result = selectComics(sample, {
      ...DEFAULT_OPTIONS,
      statusFilter: "completed",
    });
    expect(result.map((c) => c.comic_id)).toEqual(["b"]);
  });

  it("sort recent mengurutkan terbaru diupdate lebih dulu", () => {
    const result = selectComics(sample, { ...DEFAULT_OPTIONS, sort: "recent" });
    expect(result.map((c) => c.comic_id)).toEqual(["b", "c", "a"]);
  });

  it("sort alpha mengurutkan alfabetis judul", () => {
    const result = selectComics(sample, { ...DEFAULT_OPTIONS, sort: "alpha" });
    expect(result.map((c) => c.title)).toEqual([
      "Berserk",
      "Martial Peak",
      "Solo Leveling",
    ]);
  });

  it("sort type mengelompokkan per jenis lalu judul", () => {
    const result = selectComics(sample, { ...DEFAULT_OPTIONS, sort: "type" });
    expect(result.map((c) => c.type_tag)).toEqual([
      "manga",
      "manhua",
      "manhwa",
    ]);
  });

  it("menggabungkan filter dan search sekaligus", () => {
    const result = selectComics(sample, {
      ...DEFAULT_OPTIONS,
      typeFilter: "manga",
      statusFilter: "ongoing",
      search: "ber",
    });
    expect(result.map((c) => c.comic_id)).toEqual(["a"]);
  });
});

describe("selectRecent", () => {
  it("mengurutkan desc by updated_at dan membatasi ke limit", () => {
    const result = selectRecent(sample, 2);
    expect(result.map((c) => c.comic_id)).toEqual(["b", "c"]);
  });

  it("tidak memutasi array input", () => {
    const copy = [...sample];
    selectRecent(sample, 2);
    expect(sample).toEqual(copy);
  });

  it("mengembalikan seluruhnya kalau limit melebihi panjang array", () => {
    const result = selectRecent(sample, 10);
    expect(result).toHaveLength(3);
  });
});
