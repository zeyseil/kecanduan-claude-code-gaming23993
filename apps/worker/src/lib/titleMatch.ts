// Shared "is this the same comic?" gate for external metadata sources
// (MangaDex, comick, AniList, Komiku). One acceptance rule everywhere, so
// adding a source never adds a new definition of "match".
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
//
// Candidate titles are also expanded with a "core" variant before scoring:
// light-novel-style official titles are frequently "Core Title ~Long
// Descriptive Subtitle~" or "Core Title: Long Descriptive Subtitle" (dogfooding
// case: "S-Rank Party Kara Kaikosareta \"Jugushi\" ~\"Noroi no Item\" Shika
// Tsukuremasen ga...~"), while what a user actually writes down is just the
// core. The full title's length alone can push even a correct match's score
// below every tier above (a 40-char query against a 140-char official title
// scores ~0.35) — the substring tier's length-ratio guard exists specifically
// to reject that kind of length mismatch, so it can't be the fix. Splitting
// off the part before the first ":" or "~" and scoring that too catches these
// without loosening any threshold — it only ever ADDS a candidate string
// derived from a trusted source's own title, never relaxes what "matching"
// means.

import { normalizeTitle, titleSimilarity } from "../store/fuzzyMatch";

export const STRICT_THRESHOLD = 0.85;
export const RELAXED_THRESHOLD = 0.75;

const SUBSTRING_MIN_CHARS = 10;
const SUBSTRING_MIN_WORDS = 2;
const SUBSTRING_MIN_LENGTH_RATIO = 0.5;

/** Minimum normalized length for a derived core-title fragment to be usable —
 * guards against a separator appearing near the start of a title producing a
 * near-empty, overly-generic fragment (e.g. "Season 2: ..."). */
const CORE_TITLE_MIN_CHARS = 8;

/** Text before the first ":", "~", or "," (whichever comes first), if that
 * leaves a substantial fragment — null when there's no separator or the
 * fragment is too short/generic to be a safe extra candidate.
 *
 * "," is included because some official titles extend the core with a
 * comma-joined clause BEFORE the "~subtitle~"/": subtitle" tail (dogfooding
 * case: "Kuni wo Owareta Ryuushi-san, Hirowareta Ringoku de Ukkari Musou
 * Shite Shimau. ~Jakushou Kokka ga...~" — cutting only at the tilde still
 * leaves the comma-joined clause attached, so the derived core is still too
 * long to score above threshold against the short query). Taking the
 * leftmost separator naturally picks the shortest/most conservative core. */
function deriveCoreTitle(title: string): string | null {
  const colonIndex = title.indexOf(":");
  const tildeIndex = title.indexOf("~");
  const commaIndex = title.indexOf(",");
  const candidates = [colonIndex, tildeIndex, commaIndex].filter((i) => i >= 0);
  if (candidates.length === 0) return null;

  const cut = Math.min(...candidates);
  const core = title.slice(0, cut).trim();
  return normalizeTitle(core).length >= CORE_TITLE_MIN_CHARS ? core : null;
}

/** Every title plus, for each one that looks like "Core ~Subtitle~" or
 * "Core: Subtitle", the core alone as an extra candidate. */
function withCoreVariants(titles: string[]): string[] {
  const extra = titles.map(deriveCoreTitle).filter((t): t is string => t !== null);
  return extra.length === 0 ? titles : [...titles, ...extra];
}

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

/** Best similarity between the query and any of the candidate's title strings
 * (including derived core-title variants — see module comment). */
export function bestTitleScore(queryTitle: string, titles: string[]): number {
  const expanded = withCoreVariants(titles);
  if (expanded.length === 0) return 0;
  return Math.max(...expanded.map((t) => titleSimilarity(t, queryTitle)));
}

/** True when at least one title (or derived core-title variant) clears the
 * acceptance rule described above. */
export function isAcceptableTitleMatch(queryTitle: string, titles: string[]): boolean {
  return withCoreVariants(titles).some(
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
