// Deterministic fuzzy title matching for cari_komik_mirip (TOOL_CONTRACTS.md §2.1).
// Intentionally NOT reasoning-based — score is computed here in code, the
// Agent only decides what to do with the score (see LANGFLOW_FLOW.md).

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSort(normalized: string): string {
  return normalized.split(" ").filter(Boolean).sort().join(" ");
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array(cols - 1).fill(0),
  ]);
  for (let j = 1; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }
  return dist[rows - 1][cols - 1];
}

/** Token-sort similarity ratio between two titles, in [0, 1]. */
export function titleSimilarity(a: string, b: string): number {
  const sortedA = tokenSort(normalizeTitle(a));
  const sortedB = tokenSort(normalizeTitle(b));
  const maxLen = Math.max(sortedA.length, sortedB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(sortedA, sortedB) / maxLen;
}

export interface SimilarityCandidate {
  comic_id: string;
  title: string;
  score: number;
}

/** Score `candidateTitle` against each comic's title and aliases, keep the best per-comic score. */
export function rankCandidates(
  comics: Array<{ comic_id: string; title: string; aliases: string[] }>,
  candidateTitle: string,
  limit = 5,
): SimilarityCandidate[] {
  return comics
    .map((comic) => {
      const score = Math.max(
        titleSimilarity(comic.title, candidateTitle),
        ...comic.aliases.map((alias) => titleSimilarity(alias, candidateTitle)),
      );
      return { comic_id: comic.comic_id, title: comic.title, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
