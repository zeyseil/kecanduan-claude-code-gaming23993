import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import type { Comic } from "../types/comic";

interface ComicDocument extends Comic {
  user_id: string;
}
interface ProcessLogDocument {
  user_id: string;
  ts: string;
  input_text: string;
  ai_action: string;
  target_comic_id: string | null;
  confirmed: boolean;
}

// One fake in-memory "collection" per Astra collection name, shared by comics
// and process_log stores — only the network boundary is mocked.
const collections: { comics: ComicDocument[]; process_log: ProcessLogDocument[] } = {
  comics: [],
  process_log: [],
};

vi.mock("@datastax/astra-db-ts", () => {
  class FakeCollection {
    constructor(private name: "comics" | "process_log") {}

    private bucket() {
      return collections[this.name];
    }

    find(filter: { user_id: string }) {
      const results = (this.bucket() as ComicDocument[]).filter(
        (d) => d.user_id === filter.user_id,
      );
      return { toArray: async () => results };
    }

    async findOne(filter: { user_id: string; comic_id: string }) {
      return (this.bucket() as ComicDocument[]).find(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
    }

    async insertOne(doc: ComicDocument | ProcessLogDocument) {
      (this.bucket() as (ComicDocument | ProcessLogDocument)[]).push(doc);
      return { insertedId: "id" };
    }

    async findOneAndUpdate(
      filter: { user_id: string; comic_id: string },
      update: { $set: Partial<ComicDocument> },
    ) {
      const doc = (this.bucket() as ComicDocument[]).find(
        (d) => d.user_id === filter.user_id && d.comic_id === filter.comic_id,
      );
      if (!doc) return undefined;
      Object.assign(doc, update.$set);
      return doc;
    }
  }

  class FakeDb {
    collection(name: "comics" | "process_log") {
      return new FakeCollection(name);
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

const fakeRateLimiterNamespace = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response("ok") }),
} as unknown as Env["RATE_LIMITER"];

const testEnv: Env = {
  ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
  ASTRA_DB_APPLICATION_TOKEN: "fake-token",
  ASTRA_DB_COLLECTION: "comics",
  PROCESS_LOG_COLLECTION: "process_log",
  INTERNAL_TOOLS_SECRET: "test-secret",
  LANGFLOW_API_URL: "https://fake-langflow/api/v1/run/fake-flow",
  LANGFLOW_API_KEY: "fake-langflow-key",
  RATE_LIMITER: fakeRateLimiterNamespace,
  USER_RATE_LIMITER: fakeRateLimiterNamespace as unknown as Env["USER_RATE_LIMITER"],
  AUTH_TOKENS: {} as Env["AUTH_TOKENS"],
};

const AUTH_HEADERS = {
  "Content-Type": "application/json",
  "X-Internal-Secret": "test-secret",
  "X-User-Id": "demo-user",
};

function request(path: string, init?: RequestInit) {
  return app.request(`/internal/tools${path}`, init, testEnv);
}

function seedComic(overrides: Partial<ComicDocument> = {}): ComicDocument {
  const now = new Date().toISOString();
  const comic: ComicDocument = {
    user_id: "demo-user",
    comic_id: crypto.randomUUID(),
    title: "Monster",
    aliases: [],
    type_tag: "manga",
    is_adult: false,
    latest_chapter: 10,
    status: "ongoing",
    cover_url: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  collections.comics.push(comic);
  return comic;
}

describe("/internal/tools", () => {
  beforeEach(() => {
    collections.comics = [];
    collections.process_log = [];
    vi.unstubAllGlobals();
  });

  it("rejects requests without a valid X-Internal-Secret on every route", async () => {
    const res = await app.request(
      "/internal/tools/find-similar",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "demo-user" },
        body: JSON.stringify({ candidate_title: "monster" }),
      },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  describe("POST /find-similar", () => {
    it("returns ranked candidates", async () => {
      seedComic({ title: "Monster" });
      seedComic({ title: "Berserk" });

      const res = await request("/find-similar", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ candidate_title: "monster" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { candidates: Array<{ title: string; score: number }> };
      expect(body.candidates[0].title).toBe("Monster");
    });

    it("rejects a missing candidate_title", async () => {
      const res = await request("/find-similar", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /create-comic", () => {
    it("creates a comic with default status ongoing and no aliases", async () => {
      const res = await request("/create-comic", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          title: "Monsters",
          type_tag: "manhwa",
          is_adult: false,
          chapter: 32,
          status: null,
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { comic_id: string; created: boolean };
      expect(body.created).toBe(true);
      expect(collections.comics).toHaveLength(1);
      expect(collections.comics[0].status).toBe("ongoing");
      expect(collections.comics[0].latest_chapter).toBe(32);
    });

    it("rejects invalid is_adult type", async () => {
      const res = await request("/create-comic", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: "X", type_tag: "manga", is_adult: "no", chapter: 1 }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /update-chapter", () => {
    it("updates chapter and returns previous_chapter", async () => {
      const comic = seedComic({ latest_chapter: 32 });

      const res = await request("/update-chapter", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ comic_id: comic.comic_id, chapter: 33, status: null }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { updated: boolean; previous_chapter: number };
      expect(body.updated).toBe(true);
      expect(body.previous_chapter).toBe(32);
      expect(collections.comics[0].latest_chapter).toBe(33);
    });

    it("returns 404 for an unknown comic_id", async () => {
      const res = await request("/update-chapter", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ comic_id: "missing", chapter: 5 }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /fetch-cover", () => {
    it("returns a cover_url when MangaDex finds a match, sending an identifying User-Agent", async () => {
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "manga-1",
                relationships: [
                  { type: "author" },
                  { type: "cover_art", attributes: { fileName: "cover.jpg" } },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await request("/fetch-cover", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: "Monsters" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { cover_url: string | null };
      expect(body.cover_url).toBe("https://uploads.mangadex.org/covers/manga-1/cover.jpg");

      const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      const headers = new Headers(requestInit.headers);
      expect(headers.get("User-Agent")).toBeTruthy();
    });

    it("returns cover_url null when MangaDex has no match", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
      );

      const res = await request("/fetch-cover", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ title: "Unknown Title Xyz" }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()) as { cover_url: string | null }).toEqual({ cover_url: null });
    });
  });

  describe("POST /set-cover", () => {
    it("sets cover_url on an existing comic", async () => {
      const comic = seedComic({ cover_url: null });

      const res = await request("/set-cover", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          comic_id: comic.comic_id,
          cover_url: "https://uploads.mangadex.org/covers/x/y.jpg",
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ comic_id: comic.comic_id, updated: true });
      expect(collections.comics[0].cover_url).toBe("https://uploads.mangadex.org/covers/x/y.jpg");
    });

    it("returns 404 for an unknown comic_id", async () => {
      const res = await request("/set-cover", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ comic_id: "missing", cover_url: "https://example.com/x.jpg" }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects a missing cover_url", async () => {
      const comic = seedComic();
      const res = await request("/set-cover", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ comic_id: comic.comic_id }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /log-process", () => {
    it("logs a process entry", async () => {
      const res = await request("/log-process", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          input_text: "baru baca monster ch33",
          ai_action: "updated",
          target_comic_id: "id-1",
          confirmed: true,
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ logged: true });
      expect(collections.process_log).toHaveLength(1);
      expect(collections.process_log[0].ai_action).toBe("updated");
    });

    it("rejects an invalid ai_action", async () => {
      const res = await request("/log-process", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          input_text: "x",
          ai_action: "deleted",
          target_comic_id: null,
          confirmed: true,
        }),
      });
      expect(res.status).toBe(400);
    });
  });
});
