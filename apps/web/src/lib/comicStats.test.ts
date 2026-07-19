import { describe, expect, it } from "vitest";
import type { Comic } from "../types/comic";
import { summarizeComics } from "./comicStats";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "id",
    title: "Judul",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 10,
    status: "ongoing",
    cover_url: null,
    read_url: null,
    release_day: null,
    note: null,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeComics", () => {
  it("returns zeroed stats for an empty list", () => {
    expect(summarizeComics([])).toEqual({
      total: 0,
      ongoing: 0,
      completed: 0,
      totalChapters: 0,
      byType: { manga: 0, manhwa: 0, manhua: 0 },
    });
  });

  it("aggregates counts, chapter total, and type breakdown", () => {
    const comics = [
      comic({ type_tag: "manga", status: "ongoing", latest_chapter: 10 }),
      comic({ type_tag: "manhwa", status: "completed", latest_chapter: 5.5 }),
      comic({ type_tag: "manhwa", status: "ongoing", latest_chapter: 20 }),
    ];

    expect(summarizeComics(comics)).toEqual({
      total: 3,
      ongoing: 2,
      completed: 1,
      totalChapters: 35.5,
      byType: { manga: 1, manhwa: 2, manhua: 0 },
    });
  });
});
