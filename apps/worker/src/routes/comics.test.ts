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

const { app } = await import("../index");

const fakeTokens = new Map([["test-token", "demo-user"]]);

const fakeUserRateLimiterNamespace = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response("ok", { status: 200 }) }),
};

const fakeRateLimiterNamespace = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response("ok") }),
};

const testEnv = {
  ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
  ASTRA_DB_APPLICATION_TOKEN: "fake-token",
  ASTRA_DB_COLLECTION: "comics",
  AUTH_TOKENS: { get: async (key: string) => fakeTokens.get(key) ?? null },
  USER_RATE_LIMITER: fakeUserRateLimiterNamespace,
  RATE_LIMITER: fakeRateLimiterNamespace,
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

  it("accepts read_url and release_day on create, defaulting to null when omitted", async () => {
    const withFields = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Chainsaw Man",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
        read_url: "https://example.com/read/csm",
        release_day: 2,
      }),
    });
    expect(withFields.status).toBe(201);
    const createdWithFields = (await withFields.json()) as Comic;
    expect(createdWithFields.read_url).toBe("https://example.com/read/csm");
    expect(createdWithFields.release_day).toBe(2);

    const withoutFields = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Jujutsu Kaisen",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
      }),
    });
    const createdWithoutFields = (await withoutFields.json()) as Comic;
    expect(createdWithoutFields.read_url).toBeNull();
    expect(createdWithoutFields.release_day).toBeNull();
  });

  it("rejects a read_url with a non-http(s) scheme", async () => {
    const res = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Malicious",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
        read_url: "javascript:alert(1)",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a release_day outside 0-6", async () => {
    const res = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Out of range",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
        release_day: 7,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("patches read_url and release_day, rejecting an invalid read_url", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Vinland Saga",
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
      }),
    });
    const created = (await createRes.json()) as Comic;

    const patchRes = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_url: "https://example.com/read/vs", release_day: 4 }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as Comic;
    expect(patched.read_url).toBe("https://example.com/read/vs");
    expect(patched.release_day).toBe(4);

    const badPatchRes = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read_url: "not-a-url" }),
    });
    expect(badPatchRes.status).toBe(400);
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

  it("normalizes legacy documents missing read_url/release_day to null (backward-compat)", async () => {
    // Simulates a document written before these fields existed — Astra is
    // schemaless, so the field is just absent, not null.
    const legacyDoc = {
      comic_id: "legacy-1",
      title: "Old Comic",
      aliases: [],
      type_tag: "manga",
      is_adult: false,
      latest_chapter: 5,
      status: "ongoing",
      cover_url: null,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2025-01-01T00:00:00.000Z",
      user_id: "demo-user",
    } as unknown as ComicDocument;
    documents.push(legacyDoc);

    const list = (await (await request("/comics")).json()) as Comic[];
    expect(list).toHaveLength(1);
    expect(list[0].read_url).toBeNull();
    expect(list[0].release_day).toBeNull();
    expect(list[0].note).toBeNull();
  });

  it("accepts note on create and patch, rejecting one over 500 chars", async () => {
    const createRes = await request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Noted Comic",
        type_tag: "manhwa",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
        note: "  hiatus  ",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Comic;
    expect(created.note).toBe("hiatus");

    const patchRes = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "S1 end" }),
    });
    expect(((await patchRes.json()) as Comic).note).toBe("S1 end");

    const tooLong = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "x".repeat(501) }),
    });
    expect(tooLong.status).toBe(400);

    const cleared = await request(`/comics/${created.comic_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: null }),
    });
    expect(((await cleared.json()) as Comic).note).toBeNull();
  });

  describe("POST /comics/bulk-delete", () => {
    async function seed(title: string): Promise<string> {
      const res = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 1,
          status: "ongoing",
        }),
      });
      return ((await res.json()) as Comic).comic_id;
    }

    it("rejects a non-array body", async () => {
      const res = await request("/comics/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: "nope" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects more than the max", async () => {
      const ids = Array.from({ length: 26 }, (_, i) => `id-${i}`);
      const res = await request("/comics/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: ids }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects without a token", async () => {
      const res = await app.request(
        "/comics/bulk-delete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comic_ids: ["x"] }),
        },
        testEnv,
      );
      expect(res.status).toBe(401);
    });

    it("deletes existing ids and reports missing ones per-item", async () => {
      const a = await seed("A");
      const b = await seed("B");

      const res = await request("/comics/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: [a, "ghost", b] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ comic_id: string; deleted: boolean }> };
      expect(body.results).toEqual([
        { comic_id: a, deleted: true },
        { comic_id: "ghost", deleted: false },
        { comic_id: b, deleted: true },
      ]);

      const list = (await (await request("/comics")).json()) as Comic[];
      expect(list).toEqual([]);
    });
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

  describe("POST /comics/bulk", () => {
    it("rejects more than the max chunk size", async () => {
      const entries = Array.from({ length: 26 }, (_, i) => ({
        title: `Judul ${i}`,
        type_tag: "manga",
        is_adult: false,
        latest_chapter: 1,
        status: "ongoing",
      }));
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects an empty entries array", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [] }),
      });
      expect(res.status).toBe(400);
    });

    it("creates new comics that don't match anything existing", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "One Piece", type_tag: "manga", is_adult: false, latest_chapter: 1, status: "ongoing" },
            { title: "Berserk", type_tag: "manga", is_adult: true, latest_chapter: 300, status: "ongoing" },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: Array<{ title: string; action: string; cover_url?: string | null }>;
      };
      expect(body.results).toEqual([
        { title: "One Piece", action: "created", comic_id: expect.any(String), cover_url: null },
        { title: "Berserk", action: "created", comic_id: expect.any(String), cover_url: null },
      ]);

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Comic[];
      expect(list).toHaveLength(2);
    });

    it("uses cover_url/source_api carried from /detect-type when creating, skipping a redundant fetch", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              title: "One Piece",
              type_tag: "manga",
              is_adult: false,
              latest_chapter: 1,
              status: "ongoing",
              cover_url: "https://cdn/one-piece.jpg",
              source_api: "mangadex",
            },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: Array<{ title: string; action: string; comic_id?: string; cover_url?: string | null }>;
      };
      expect(body.results[0]).toEqual({
        title: "One Piece",
        action: "created",
        comic_id: expect.any(String),
        cover_url: "https://cdn/one-piece.jpg",
      });

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Array<{ title: string; cover_url: string | null; source_api?: string | null }>;
      const created = list.find((c) => c.title === "One Piece")!;
      expect(created.cover_url).toBe("https://cdn/one-piece.jpg");
      expect(created.source_api).toBe("mangadex");
    });

    it("rejects a non-string cover_url on a bulk entry", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "One Piece", type_tag: "manga", is_adult: false, latest_chapter: 1, status: "ongoing", cover_url: 123 },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body2 = (await res.json()) as { results: Array<{ action: string; reason?: string }> };
      expect(body2.results[0].action).toBe("error");
      expect(body2.results[0].reason).toMatch(/cover_url/);
    });

    it("updates an existing comic when the imported chapter is higher (upsert, not duplicate)", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Naruto",
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 5,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "Naruto", type_tag: "manga", is_adult: false, latest_chapter: 10, status: "ongoing" },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ title: string; action: string; comic_id: string }> };
      expect(body.results).toEqual([{ title: "Naruto", action: "updated", comic_id: created.comic_id }]);

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Comic[];
      expect(list).toHaveLength(1);
      expect(list[0].latest_chapter).toBe(10);
    });

    it("skips (not duplicates) when the imported chapter isn't higher than what's stored", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Naruto",
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 10,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "Naruto", type_tag: "manga", is_adult: false, latest_chapter: 10, status: "ongoing" },
          ],
        }),
      });
      const body = (await res.json()) as { results: Array<{ title: string; action: string; comic_id: string }> };
      expect(body.results).toEqual([
        { title: "Naruto", action: "skipped", comic_id: created.comic_id, reason: expect.any(String) },
      ]);

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Comic[];
      expect(list).toHaveLength(1);
    });

    it("reports invalid entries as errors without failing the whole chunk", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "Valid Comic", type_tag: "manga", is_adult: false, latest_chapter: 1, status: "ongoing" },
            { title: "", type_tag: "manga", is_adult: false, latest_chapter: 1, status: "ongoing" },
          ],
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ action: string }> };
      expect(body.results[0].action).toBe("created");
      expect(body.results[1].action).toBe("error");
    });

    it("stores the parser's note on created comics", async () => {
      const res = await request("/comics/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            { title: "Comic Hiatus", type_tag: "manhwa", is_adult: false, latest_chapter: 45, status: "ongoing", note: "hiatus" },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(documents[0].note).toBe("hiatus");
    });
  });

  describe("POST /comics/backfill-covers", () => {
    it("rejects more than the max chunk size", async () => {
      const res = await request("/comics/backfill-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: Array.from({ length: 16 }, (_, i) => `id-${i}`) }),
      });
      expect(res.status).toBe(400);
    });

    it("fetches and saves a cover for a comic missing one", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "One Piece",
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 1,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      const fetchMock = vi.fn(async (url: string) => {
        // Echo the queried title so the entry clears the similarity gate in
        // fetchMangaDexInfo (real API shape: attributes.title + originalLanguage).
        const queried = decodeURIComponent(new URL(url).searchParams.get("title") ?? "");
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "manga-1",
                attributes: { title: { en: queried }, altTitles: [], originalLanguage: "ja" },
                relationships: [{ type: "cover_art", attributes: { fileName: "cover.jpg" } }],
              },
            ],
          }),
          { status: 200 },
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await request("/comics/backfill-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: [created.comic_id] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ comic_id: string; cover_url: string | null }> };
      expect(body.results[0].cover_url).toBe("https://uploads.mangadex.org/covers/manga-1/cover.jpg");

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Comic[];
      expect(list[0].cover_url).toBe("https://uploads.mangadex.org/covers/manga-1/cover.jpg");

      vi.unstubAllGlobals();
    });

    it("reports missing comics without throwing", async () => {
      const res = await request("/comics/backfill-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: ["missing-id"] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { results: Array<{ comic_id: string; reason?: string }> };
      expect(body.results).toEqual([{ comic_id: "missing-id", cover_url: null, reason: "comic tidak ditemukan" }]);
    });

    it("leaves cover_url null when MangaDex has no match, without failing other entries", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Judul Antah Berantah",
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 1,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
      );

      const res = await request("/comics/backfill-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_ids: [created.comic_id] }),
      });
      const body = (await res.json()) as { results: Array<{ cover_url: string | null; reason?: string }> };
      expect(body.results[0].cover_url).toBeNull();
      expect(body.results[0].reason).toBe("tidak ditemukan di sumber cover manapun");

      vi.unstubAllGlobals();
    });
  });

  describe("POST /comics/fetch-read-url", () => {
    it("rejects requests without a valid Authorization token", async () => {
      const res = await app.request(
        "/comics/fetch-read-url",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comic_id: "x" }) },
        testEnv,
      );
      expect(res.status).toBe(401);
    });

    it("rejects a missing/invalid comic_id", async () => {
      const res = await request("/comics/fetch-read-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("reports comic not found", async () => {
      const res = await request("/comics/fetch-read-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_id: "missing-id" }),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { read_url: null; reason: string };
      expect(body).toEqual({ read_url: null, reason: "comic tidak ditemukan" });
    });

    it("finds the next chapter's comick.dev reader URL for an existing comic", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Solo Leveling",
          type_tag: "manhwa",
          is_adult: false,
          latest_chapter: 200,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          const u = String(url);
          if (u.includes("/v1.0/search/")) {
            return new Response(
              JSON.stringify([
                { hid: "71gMd0vF", slug: "00-solo-leveling", title: "Solo Leveling", country: "kr", md_titles: [], md_covers: [] },
              ]),
              { status: 200 },
            );
          }
          if (u.includes("/chapters")) {
            return new Response(
              JSON.stringify({ chapters: [{ hid: "bbb", chap: "201", lang: "en" }, { hid: "ccc", chap: "200", lang: "en" }] }),
              { status: 200 },
            );
          }
          return new Response("not found", { status: 404 });
        }),
      );

      const res = await request("/comics/fetch-read-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_id: created.comic_id }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { read_url: string | null };
      expect(body.read_url).toBe("https://comick.dev/comic/00-solo-leveling/bbb-chapter-201-en");

      vi.unstubAllGlobals();
    });

    it("returns a reason without writing anything when comick has no next chapter", async () => {
      const createRes = await request("/comics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Judul Antah Berantah",
          type_tag: "manga",
          is_adult: false,
          latest_chapter: 1,
          status: "ongoing",
        }),
      });
      const created = (await createRes.json()) as Comic;

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
      );

      const res = await request("/comics/fetch-read-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comic_id: created.comic_id }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { read_url: string | null; reason?: string };
      expect(body.read_url).toBeNull();
      expect(body.reason).toBe("Komik tidak ditemukan di comick.dev");

      const listRes = await request("/comics");
      const list = (await listRes.json()) as Comic[];
      expect(list.find((c) => c.comic_id === created.comic_id)?.read_url ?? null).toBeNull();

      vi.unstubAllGlobals();
    });
  });

  describe("POST /comics/detect-type", () => {
    it("rejects requests without a valid Authorization token", async () => {
      const res = await app.request(
        "/comics/detect-type",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titles: ["Naruto"] }) },
        testEnv,
      );
      expect(res.status).toBe(401);
    });

    it("rejects more than the max number of titles", async () => {
      const res = await request("/comics/detect-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: Array.from({ length: 11 }, (_, i) => `Judul ${i}`) }),
      });
      expect(res.status).toBe(400);
    });

    it("detects type_tag from MangaDex originalLanguage", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          const queried = decodeURIComponent(new URL(url).searchParams.get("title") ?? "");
          return new Response(
            JSON.stringify({
              data: [
                { id: "m-1", attributes: { title: { en: queried }, altTitles: [], originalLanguage: "ko" }, relationships: [] },
              ],
            }),
            { status: 200 },
          );
        }),
      );

      const res = await request("/comics/detect-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: ["Solo Leveling"] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        results: Array<{ title: string; type_tag: string | null; cover_url?: string | null; source_api?: string | null }>;
      };
      // No cover_art relationship in the fixture, so cover_url is null — the
      // route still surfaces it (and source_api) alongside a resolved type_tag.
      expect(body.results).toEqual([
        { title: "Solo Leveling", type_tag: "manhwa", cover_url: null, source_api: "mangadex" },
      ]);

      vi.unstubAllGlobals();
    });

    it("reports type_tag null with a reason when nothing matches", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
      );

      const res = await request("/comics/detect-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: ["Judul Antah Berantah"] }),
      });
      const body = (await res.json()) as { results: Array<{ type_tag: string | null; reason?: string }> };
      expect(body.results[0].type_tag).toBeNull();
      expect(body.results[0].reason).toBeTruthy();

      vi.unstubAllGlobals();
    });
  });
});

describe("CORS", () => {
  function preflight(origin: string, env: Record<string, unknown>) {
    return app.request(
      "/comics",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      env,
    );
  }

  it("allows an origin listed in ALLOWED_ORIGINS", async () => {
    const env = { ...testEnv, ALLOWED_ORIGINS: "https://komik.pages.dev" };
    const res = await preflight("https://komik.pages.dev", env);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://komik.pages.dev",
    );
  });

  it("does not allow an origin outside ALLOWED_ORIGINS", async () => {
    const env = { ...testEnv, ALLOWED_ORIGINS: "https://komik.pages.dev" };
    const res = await preflight("https://evil.example", env);
    expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(
      "https://evil.example",
    );
  });

  it("falls back to localhost dev origin when ALLOWED_ORIGINS is unset", async () => {
    const res = await preflight("http://localhost:5173", testEnv);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
  });
});
