import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Comic } from "../types/comic";

interface ComicDocument extends Comic {
  user_id: string;
}

// Fake Astra Data API: in-memory documents, reset per test. Only the network
// boundary (@datastax/astra-db-ts) is mocked — comicStore/astraComicRepository
// and the routes run for real against this fake collection.
let documents: ComicDocument[] = [];

vi.mock("@datastax/astra-db-ts", () => {
  class FakeCollection {
    find(filter: { user_id: string }) {
      const results = documents.filter((d) => d.user_id === filter.user_id);
      return { toArray: async () => results };
    }

    async findOne(filter: { user_id: string; comic_id: string }) {
      return documents.find(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
    }

    async insertOne(doc: ComicDocument) {
      documents.push(doc);
      return { insertedId: doc.comic_id };
    }

    async findOneAndUpdate(
      filter: { user_id: string; comic_id: string },
      update: { $set: Partial<ComicDocument> },
    ) {
      const doc = documents.find(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
      if (!doc) return undefined;
      Object.assign(doc, update.$set);
      return doc;
    }
  }

  class FakeDb {
    collection() {
      return new FakeCollection();
    }
  }

  class DataAPIClient {
    db() {
      return new FakeDb();
    }
  }

  return { DataAPIClient };
});

const { default: app } = await import("../index");

const testEnv = {
  ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
  ASTRA_DB_APPLICATION_TOKEN: "fake-token",
  ASTRA_DB_COLLECTION: "comics",
};

function request(input: string, init?: RequestInit) {
  return app.request(input, init, testEnv);
}

describe("/comics", () => {
  beforeEach(() => {
    documents = [];
  });

  it("lists no comics initially", async () => {
    const res = await request("/comics");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("rejects an invalid create body", async () => {
    const res = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates then lists a comic", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "One Piece",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1120,
        status: "ongoing",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Comic;
    expect(created.comic_id).toBeTruthy();
    expect(created.title).toBe("One Piece");

    const listRes = await request("/comics");
    const list = (await listRes.json()) as Comic[];
    expect(list).toHaveLength(1);
    expect(list[0].comic_id).toBe(created.comic_id);
  });

  it("returns 404 when patching a missing comic", async () => {
    const res = await request("/comics/missing-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latest_chapter: 2 }),
    });
    expect(res.status).toBe(404);
  });

  it("patches an existing comic", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Berserk",
        type_tag: "manga",
        is_adult: true,
        latest_chapter: 364,
        status: "ongoing",
      }),
    });
    const created = (await createRes.json()) as Comic;

    const patchRes = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latest_chapter: 365, status: "completed" }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as Comic;
    expect(patched.latest_chapter).toBe(365);
    expect(patched.status).toBe("completed");
    expect(patched.is_adult).toBe(true);
  });
});
