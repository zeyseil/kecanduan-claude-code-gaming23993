interface MangaDexCoverArtAttributes {
  fileName: string;
}

interface MangaDexRelationship {
  type: string;
  attributes?: MangaDexCoverArtAttributes;
}

interface MangaDexMangaEntry {
  id: string;
  relationships: MangaDexRelationship[];
}

interface MangaDexSearchResponse {
  data: MangaDexMangaEntry[];
}

/** Public MangaDex API lookup for a manga's cover, by title. Returns null if not found. */
export async function fetchMangaDexCover(title: string): Promise<string | null> {
  const url = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=1&includes[]=cover_art`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const body = (await res.json()) as MangaDexSearchResponse;
  const manga = body.data?.[0];
  if (!manga) return null;

  const coverArt = manga.relationships.find((r) => r.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;
  if (!fileName) return null;

  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}`;
}
