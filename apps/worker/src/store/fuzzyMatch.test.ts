import { describe, expect, it } from "vitest";
import { normalizeTitle, titleSimilarity, rankCandidates } from "./fuzzyMatch";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeTitle("  Monster's,  Journey!! ")).toBe("monster s journey");
  });
});

describe("titleSimilarity", () => {
  it("returns 1 for identical titles", () => {
    expect(titleSimilarity("One Piece", "One Piece")).toBe(1);
  });

  it("is high for near-identical titles with different casing/spacing", () => {
    expect(titleSimilarity("one piece", "  One   Piece  ")).toBeGreaterThan(0.95);
  });

  it("is order-independent for word order (token-sort)", () => {
    expect(titleSimilarity("Journey Monster", "Monster Journey")).toBe(1);
  });

  it("is low for unrelated titles", () => {
    expect(titleSimilarity("One Piece", "Berserk")).toBeLessThan(0.5);
  });
});

describe("rankCandidates", () => {
  const comics = [
    { comic_id: "1", title: "Monster", aliases: [] },
    { comic_id: "2", title: "Monster Girl Doctor", aliases: ["MG Doctor"] },
    { comic_id: "3", title: "Berserk", aliases: [] },
  ];

  it("sorts by descending score", () => {
    const results = rankCandidates(comics, "monster");
    expect(results[0].comic_id).toBe("1");
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });

  it("caps results at the given limit", () => {
    expect(rankCandidates(comics, "monster", 2)).toHaveLength(2);
  });

  it("uses the best score across title and aliases", () => {
    const results = rankCandidates(comics, "MG Doctor");
    const match = results.find((r) => r.comic_id === "2");
    expect(match?.score).toBeGreaterThan(0.9);
  });
});
