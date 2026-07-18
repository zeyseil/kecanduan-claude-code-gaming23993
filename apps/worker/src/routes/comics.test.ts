import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Comic } from "../types/comic";

interface ComicDocument extends Comic {
  user_id: string;
}

// Fake Astra Data API: in-memory documents, reset per test. Only the network
// boundary (@datastax/astra-db-ts) is mocked — comicStore/astraComicRepository
// and the routes run for real against this fake collection.
let documents: ComicDocument[] = [];
let shouldFailWrite = false;

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
      if (shouldFailWrite) {
        throw new Error("Document size limit exceeded");
      }
      documents.push(doc);
      return { insertedId: doc.comic_id };
    }

    async findOneAndUpdate(
      filter: { user_id: string; comic_id: string },
      update: { $set: Partial<ComicDocument> },
    ) {
      if (shouldFailWrite) {
        throw new Error("Document size limit exceeded");
      }
      const doc = documents.find(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
      if (!doc) return undefined;
      Object.assign(doc, update.$set);
      return doc;
    }

    async deleteOne(filter: { user_id: string; comic_id: string }) {
      const index = documents.findIndex(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
      if (index === -1) return { deletedCount: 0 };
      documents.splice(index, 1);
      return { deletedCount: 1 };
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

const fakeTokens = new Map([["test-token", "demo-user"]]);

const fakeUserRateLimiterNamespace = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response("ok", { status: 200 }) }),
};

const testEnv = {
  ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
  ASTRA_DB_APPLICATION_TOKEN: "fake-token",
  ASTRA_DB_COLLECTION: "comics",
  AUTH_TOKENS: { get: async (key: string) => fakeTokens.get(key) ?? null },
  USER_RATE_LIMITER: fakeUserRateLimiterNamespace,
};

function request(input: string, init?: RequestInit) {
  return app.request(
    input,
    { ...init, headers: { ...init?.headers, Authorization: "Bearer test-token" } },
    testEnv,
  );
}

describe("/comics", () => {
  beforeEach(() => {
    documents = [];
    shouldFailWrite = false;
  });

  it("rejects requests without a valid Authorization token", async () => {
    const res = await app.request("/comics", {}, testEnv);
    expect(res.status).toBe(401);
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

  it("returns 404 when deleting a missing comic", async () => {
    const res = await request("/comics/missing-id", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("deletes an existing comic", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Vagabond",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 327,
        status: "ongoing",
      }),
    });
    const created = (await createRes.json()) as Comic;

    const deleteRes = await request(`/comics/${created.comic_id}`, { method: "DELETE" });
    expect(deleteRes.status).toBe(204);

    const listRes = await request("/comics");
    const list = (await listRes.json()) as Comic[];
    expect(list).toEqual([]);
  });

  it("returns a clear error message when the store fails to save on create", async () => {
    shouldFailWrite = true;
    const res = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Big Cover",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
      }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Gagal menyimpan komik");
    expect(body.error).toContain("Document size limit exceeded");
  });

  it("returns a clear error message when the store fails to save on patch", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Big Cover",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
      }),
    });
    const created = (await createRes.json()) as Comic;

    shouldFailWrite = true;
    const patchRes = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latest_chapter: 2 }),
    });
    expect(patchRes.status).toBe(500);
    const body = (await patchRes.json()) as { error: string };
    expect(body.error).toContain("Gagal menyimpan komik");
  });

  it("returns 429 when the user rate limiter rejects the request", async () => {
    const limitedEnv = {
      ...testEnv,
      USER_RATE_LIMITER: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: async () => new Response("rate limited", { status: 429 }) }),
      },
    };
    const res = await app.request(
      "/comics",
      { headers: { Authorization: "Bearer test-token" } },
      limitedEnv,
    );
    expect(res.status).toBe(429);
  });
});
