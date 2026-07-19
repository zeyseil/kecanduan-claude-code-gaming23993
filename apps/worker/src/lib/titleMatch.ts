// Shared "is this the same comic?" gate for external metadata sources
// (MangaDex, AniList). One acceptance rule everywhere, so adding a source
// never adds a new definition of "match".
//
// Acceptance is three-tier (dogfooding showed a flat 0.85 bar rejects half the
// user's real titles — short forms, missing articles, truncated suffixes):
//   1. score >= STRICT_THRESHOLD (0.85) — clearly the same title.
//   2. score >= RELAXED_THRESHOLD (0.75) — near-miss like a missing article
//      ("I am hero" vs "I Am a Hero" scores 0.8).
//   3. Substring containment for truncated titles ("Kage no jitsuryokusha" for
//      "Kage no Jitsuryokusha ni Naritakute!"): the normalized query must be
//      contained in a candidate title (or vice versa), be >= 10 chars and
//      >= 2 words (so "monsters" can't glob onto everything), and the shorter
//      string must be at least half the longer one's length.

import { normalizeTitle, titleSimilarity } from "../store/fuzzyMatch";

export const STRICT_THRESHOLD = 0.85;
export const RELAXED_THRESHOLD = 0.75;

const SUBSTRING_MIN_CHARS = 10;
const SUBSTRING_MIN_WORDS = 2;
const SUBSTRING_MIN_LENGTH_RATIO = 0.5;

function isSubstringMatch(queryTitle: string, candidateTitle: string): boolean {
  const q = normalizeTitle(queryTitle);
  const c = normalizeTitle(candidateTitle);
  if (q.length < SUBSTRING_MIN_CHARS) return false;
  if (q.split(" ").length < SUBSTRING_MIN_WORDS) return false;
  if (c === "") return false;

  const shorter = Math.min(q.length, c.length);
  const longer = Math.max(q.length, c.length);
  if (shorter / longer < SUBSTRING_MIN_LENGTH_RATIO) return false;

  return c.includes(q) || q.includes(c);
}

/** Best similarity between the query and any of the candidate's title strings. */
export function bestTitleScore(queryTitle: string, titles: string[]): number {
  if (titles.length === 0) return 0;
  return Math.max(...titles.map((t) => titleSimilarity(t, queryTitle)));
}

/** True when at least one title clears the acceptance rule described above. */
export function isAcceptableTitleMatch(queryTitle: string, titles: string[]): boolean {
  return titles.some(
    (t) =>
      titleSimilarity(t, queryTitle) >= RELAXED_THRESHOLD || isSubstringMatch(queryTitle, t),
  );
}

/**
 * Picks the entry whose best title is closest to `queryTitle`, or null when no
 * entry passes the acceptance rule. `titlesOf` extracts every title string
 * (primary + alternates/synonyms) from an entry.
 */
export function pickBestTitleMatch<T>(
  entries: T[],
  queryTitle: string,
  titlesOf: (entry: T) => string[],
): T | null {
  // Only acceptable entries compete — a high-scoring but unacceptable entry
  // must not shadow a lower-scoring one that passes via the substring tier.
  let best: { entry: T; score: number } | null = null;

  for (const entry of entries) {
    const titles = titlesOf(entry);
    if (titles.length === 0 || !isAcceptableTitleMatch(queryTitle, titles)) continue;
    const score = bestTitleScore(queryTitle, titles);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best ? best.entry : null;
}
