import { describe, expect, it } from "vitest";
import { isAcceptableTitleMatch, pickBestTitleMatch } from "./titleMatch";

describe("isAcceptableTitleMatch", () => {
  it("accepts an exact title (strict tier)", () => {
    expect(isAcceptableTitleMatch("Solo Leveling", ["Solo Leveling"])).toBe(true);
  });

  it("accepts a near-miss like a missing article (relaxed tier, kasus log 'I am hero')", () => {
    expect(isAcceptableTitleMatch("I am hero", ["I Am a Hero"])).toBe(true);
  });

  it("accepts a truncated title contained in the candidate (substring tier, kasus log)", () => {
    expect(
      isAcceptableTitleMatch("Kage no jitsuryokusha", ["Kage no Jitsuryokusha ni Naritakute!"]),
    ).toBe(true);
  });

  it("rejects a single short word even when it's a substring (mencegah 'monsters' nyantol ke semua)", () => {
    expect(isAcceptableTitleMatch("Monsters", ["Monsters University Gaiden"])).toBe(false);
  });

  it("rejects a substring when the candidate is far longer (rasio panjang < 0.5)", () => {
    expect(
      isAcceptableTitleMatch("the world after", [
        "The World After the Fall and Everything That Came Before It Retold Again",
      ]),
    ).toBe(false);
  });

  it("rejects an unrelated title", () => {
    expect(isAcceptableTitleMatch("Naruto", ["Berserk of Gluttony"])).toBe(false);
  });

  it("accepts a short-form title against an official title with a long ~subtitle~ tail (core-title tier, kasus log)", () => {
    // Real MangaDex title for this manga — the ~...~ tail alone is ~90 chars,
    // long enough that the full-string score (~0.35) clears no other tier.
    expect(
      isAcceptableTitleMatch('S-Rank Party kara kaikosareta "jugushi"', [
        'S-Rank Party Kara Kaikosareta "Jugushi" ~"Noroi no Item" Shika Tsukuremasen ga, Sono Seinou wa Artifact-kyuu nari......!~',
      ]),
    ).toBe(true);
  });

  it("accepts a short-form title against an official title with a long : subtitle tail (core-title tier, kasus log)", () => {
    // Real MangaDex title — also has a one-word variant ("Jitsu" vs the
    // query's "Jitsuryoku"), so the core match relies on the relaxed
    // threshold, not an exact core match.
    expect(
      isAcceptableTitleMatch("Fuguushoku \"Kanteishi\" ga Jitsuryoku wa Saikyou Datta", [
        "Fuguushoku [Kanteishi] ga Jitsu wa Saikyou datta: Naraku de Kitaeta Saikyou no [Shingan] de Musou Suru",
      ]),
    ).toBe(true);
  });

  it("does not derive a core title when the separator produces too short a fragment", () => {
    // ":"  appears almost immediately — "Season 2" alone is too generic/short
    // to safely add as an extra candidate.
    expect(
      isAcceptableTitleMatch("Some Completely Unrelated Manga", [
        "S2: A Totally Different Story About Something Else Entirely",
      ]),
    ).toBe(false);
  });
});

describe("pickBestTitleMatch", () => {
  const entries = [
    { id: "wrong", titles: ["Kage kara Mamoru!"] },
    { id: "right", titles: ["Kage no Jitsuryokusha ni Naritakute!"] },
  ];

  it("picks the substring-acceptable entry even when another entry shares words", () => {
    const match = pickBestTitleMatch(entries, "Kage no jitsuryokusha", (e) => e.titles);
    expect(match?.id).toBe("right");
  });

  it("returns null when nothing is acceptable", () => {
    expect(pickBestTitleMatch(entries, "One Piece", (e) => e.titles)).toBeNull();
  });
});
