import type { Env } from "../env";
import type { Comic } from "../types/comic";
import type { ComicRepository } from "./comicRepository";
import { getCollection } from "./astraClient";
import { rankCandidates } from "./fuzzyMatch";

function toComic(doc: Comic & { user_id: string; _id?: unknown }): Comic {
  const comic = { ...doc };
  delete (comic as { user_id?: string }).user_id;
  delete (comic as { _id?: unknown })._id;
  // Documents written before read_url/release_day existed have these fields
  // missing entirely (Astra is schemaless) — normalize to null so the type stays honest.
  comic.read_url = comic.read_url ?? null;
  comic.release_day = comic.release_day ?? null;
  comic.note = comic.note ?? null;
  return comic;
}

export function createAstraComicRepository(env: Env): ComicRepository {
  const collection = getCollection(env);

  return {
    async listComics(userId) {
      const docs = await collection.find({ user_id: userId }).toArray();
      return docs.map(toComic);
    },

    async insertComic(userId, comic) {
      await collection.insertOne({ ...comic, user_id: userId });
      return comic;
    },

    async findComic(userId, comicId) {
      const doc = await collection.findOne({ user_id: userId, comic_id: comicId });
      return doc ? toComic(doc) : undefined;
    },

    async updateComic(userId, comicId, patch) {
      const result = await collection.findOneAndUpdate(
        { user_id: userId, comic_id: comicId },
        { $set: { ...patch, updated_at: new Date().toISOString() } },
        { returnDocument: "after" },
      );
      return result ? toComic(result) : undefined;
    },

    async deleteComic(userId, comicId) {
      const result = await collection.deleteOne({ user_id: userId, comic_id: comicId });
      return result.deletedCount > 0;
    },

    async searchComics(userId, candidateTitle) {
      const docs = await collection.find({ user_id: userId }).toArray();
      return rankCandidates(docs.map(toComic), candidateTitle);
    },

    async countComicsPerUser() {
      // Projection pulls ONLY user_id — titles/covers never leave Astra, so an
      // admin aggregating counts can't see any other user's content.
      const docs = await collection
        .find({}, { projection: { user_id: 1 } })
        .toArray();
      const counts = new Map<string, number>();
      for (const doc of docs as Array<{ user_id: string }>) {
        counts.set(doc.user_id, (counts.get(doc.user_id) ?? 0) + 1);
      }
      return [...counts.entries()].map(([user_id, count]) => ({ user_id, count }));
    },
  };
}
