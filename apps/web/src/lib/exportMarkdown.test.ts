import { describe, expect, it } from "vitest";
import type { Comic } from "../types/comic";
import { parseHistoris } from "./parseHistoris";
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
  it("formats a line as 'Judul(jenis) : chN' for non-adult ongoing without note", () => {
    const md = buildMarkdown([comic()]);
    expect(md).toBe("Berserk(manga) : ch374");
  });

  it("appends suffix 18 on the type only when is_adult", () => {
    const md = buildMarkdown([
      comic({ title: "Solo Leveling", type_tag: "manhwa", latest_chapter: 200, is_adult: true }),
    ]);
    expect(md).toContain("Solo Leveling(manhwa18) : ch200");
  });

  it("keeps decimal chapters", () => {
    const md = buildMarkdown([comic({ latest_chapter: 11.5 })]);
    expect(md).toContain("ch11.5");
  });

  it("marks completed status", () => {
    const md = buildMarkdown([comic({ status: "completed" })]);
    expect(md).toBe("Berserk(manga) : ch374(completed)");
  });

  it("carries the note when ongoing", () => {
    const md = buildMarkdown([comic({ note: "hiatus" })]);
    expect(md).toBe("Berserk(manga) : ch374(hiatus)");
  });

  it("joins multiple comics with newlines, no separators", () => {
    const md = buildMarkdown([comic({ comic_id: "a", title: "A" }), comic({ comic_id: "b", title: "B" })]);
    expect(md).toBe("A(manga) : ch374\nB(manga) : ch374");
  });

  it("returns an empty string for an empty list", () => {
    expect(buildMarkdown([])).toBe("");
  });

  it("roundtrips through parseHistoris for the common cases", () => {
    const comics = [
      comic({ comic_id: "a", title: "Berserk", latest_chapter: 374 }),
      comic({
        comic_id: "b",
        title: "Solo Leveling",
        type_tag: "manhwa",
        latest_chapter: 200,
        is_adult: true,
        status: "completed",
      }),
      comic({ comic_id: "c", title: "Monster Devourer", type_tag: "manhwa", note: "hiatus" }),
    ];
    const md = buildMarkdown(comics);
    const { ok, failed } = parseHistoris(md);

    expect(failed).toEqual([]);
    expect(ok).toEqual([
      { id: expect.any(String), title: "Berserk", type_tag: "manga", is_adult: false, latest_chapter: 374, status: "ongoing", note: null },
      {
        id: expect.any(String),
        title: "Solo Leveling",
        type_tag: "manhwa",
        is_adult: true,
        latest_chapter: 200,
        status: "completed",
        note: null,
      },
      {
        id: expect.any(String),
        title: "Monster Devourer",
        type_tag: "manhwa",
        is_adult: false,
        latest_chapter: 374,
        status: "ongoing",
        note: "hiatus",
      },
    ]);
  });
});

describe("exportFileName", () => {
  it("uses the date", () => {
    expect(exportFileName(new Date("2026-07-19T10:00:00Z"))).toBe("komik-terbaca-2026-07-19.md");
  });
});
