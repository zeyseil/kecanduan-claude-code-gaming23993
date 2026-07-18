import { beforeEach, describe, expect, it } from "vitest";
import type { Comic } from "../types/comic";
import { findComic, insertComic, listComics, resetStore, updateComic } from "./comicStore";

function makeComic(overrides: Partial<Comic> = {}): Comic {
  const now = new Date().toISOString();
  return {
    comic_id: "id-1",
    title: "Judul",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 1,
    status: "ongoing",
    cover_url: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("comicStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("starts empty per user", () => {
    expect(listComics("demo-user")).toEqual([]);
  });

  it("inserts and lists comics scoped to user_id", () => {
    insertComic("user-a", makeComic({ comic_id: "a1" }));
    insertComic("user-b", makeComic({ comic_id: "b1" }));

    expect(listComics("user-a").map((c) => c.comic_id)).toEqual(["a1"]);
    expect(listComics("user-b").map((c) => c.comic_id)).toEqual(["b1"]);
  });

  it("finds a comic by id within a user", () => {
    insertComic("user-a", makeComic({ comic_id: "a1" }));
    expect(findComic("user-a", "a1")?.comic_id).toBe("a1");
    expect(findComic("user-a", "missing")).toBeUndefined();
  });

  it("updates a comic and bumps updated_at", async () => {
    insertComic("user-a", makeComic({ comic_id: "a1", latest_chapter: 1 }));
    const before = findComic("user-a", "a1")!.updated_at;

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = updateComic("user-a", "a1", { latest_chapter: 2 });

    expect(updated?.latest_chapter).toBe(2);
    expect(updated?.updated_at).not.toBe(before);
  });

  it("returns undefined when updating a missing comic", () => {
    expect(updateComic("user-a", "missing", { latest_chapter: 2 })).toBeUndefined();
  });
});
