import { describe, expect, it } from "vitest";
import type { Comic } from "../types/comic";
import { buildMarkdown, exportFileName } from "./exportMarkdown";

function comic(overrides: Partial<Comic> = {}): Comic {
  return {
    comic_id: "c1",
    title: "Berserk",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 374,
    status: "ongoing",
    cover_url: null,
    read_url: null,
    release_day: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildMarkdown", () => {
  it("formats a line as 'judul | jenis | chN | ' for non-adult", () => {
    const md = buildMarkdown([comic()]);
    expect(md).toBe("---\nBerserk | manga | ch374 | \n---\n");
  });

  it("appends 18+ only when is_adult", () => {
    const md = buildMarkdown([
      comic({ title: "Solo Leveling", type_tag: "manhwa", latest_chapter: 200, is_adult: true }),
    ]);
    expect(md).toContain("Solo Leveling | manhwa | ch200 | 18+");
  });

  it("keeps decimal chapters", () => {
    const md = buildMarkdown([comic({ latest_chapter: 11.5 })]);
    expect(md).toContain("| ch11.5 |");
  });

  it("separates multiple comics with ---", () => {
    const md = buildMarkdown([comic({ comic_id: "a", title: "A" }), comic({ comic_id: "b", title: "B" })]);
    expect(md).toBe("---\nA | manga | ch374 | \n---\nB | manga | ch374 | \n---\n");
  });

  it("returns just a separator for an empty list", () => {
    expect(buildMarkdown([])).toBe("---\n");
  });
});

describe("exportFileName", () => {
  it("uses the date", () => {
    expect(exportFileName(new Date("2026-07-19T10:00:00Z"))).toBe("komik-terbaca-2026-07-19.md");
  });
});
