import { describe, it, expect } from "vitest";
import { createComic } from "./createComic";

const FIXED_NOW = new Date("2026-07-18T10:00:00.000Z");

describe("createComic", () => {
  it("mengisi field wajib dari input", () => {
    const comic = createComic(
      {
        title: "Judul Baru",
        type_tag: "manhwa",
        is_adult: false,
        latest_chapter: 12.5,
        cover_url: null,
      },
      FIXED_NOW,
    );

    expect(comic.title).toBe("Judul Baru");
    expect(comic.type_tag).toBe("manhwa");
    expect(comic.latest_chapter).toBe(12.5);
    expect(comic.cover_url).toBeNull();
  });

  it("men-generate comic_id unik", () => {
    const a = createComic(
      { title: "A", type_tag: "manga", is_adult: false, latest_chapter: 1, cover_url: null },
      FIXED_NOW,
    );
    const b = createComic(
      { title: "B", type_tag: "manga", is_adult: false, latest_chapter: 1, cover_url: null },
      FIXED_NOW,
    );
    expect(a.comic_id).not.toBe(b.comic_id);
  });

  it("default status ongoing dan aliases kosong untuk entry manual baru", () => {
    const comic = createComic(
      { title: "A", type_tag: "manga", is_adult: false, latest_chapter: 1, cover_url: null },
      FIXED_NOW,
    );
    expect(comic.status).toBe("ongoing");
    expect(comic.aliases).toEqual([]);
  });

  it("is_adult mengikuti input apa adanya, tidak pernah masuk ke type_tag", () => {
    const comic = createComic(
      {
        title: "Konten Dewasa",
        type_tag: "manhua",
        is_adult: true,
        latest_chapter: 1,
        cover_url: null,
      },
      FIXED_NOW,
    );
    expect(comic.is_adult).toBe(true);
    expect(comic.type_tag).toBe("manhua");
  });

  it("created_at dan updated_at memakai waktu yang di-inject", () => {
    const comic = createComic(
      { title: "A", type_tag: "manga", is_adult: false, latest_chapter: 1, cover_url: null },
      FIXED_NOW,
    );
    expect(comic.created_at).toBe(FIXED_NOW.toISOString());
    expect(comic.updated_at).toBe(FIXED_NOW.toISOString());
  });
});
