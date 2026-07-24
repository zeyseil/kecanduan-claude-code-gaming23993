import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";

// Fake Astra Data API keyed by collection name. Supports the query shapes the
// admin aggregates need: find({}), find({user_id}), find({ts:{$gte}}) with
// sort + limit. Only the network boundary is mocked.
let comicDocs: Array<Record<string, unknown>> = [];
let logDocs: Array<Record<string, unknown>> = [];

vi.mock("@datastax/astra-db-ts", () => {
  class FakeCollection {
    constructor(private readonly name: string) {}
    private get docs() {
      return this.name === "process_log" ? logDocs : comicDocs;
    }

    find(filter: Record<string, unknown>, options?: { sort?: Record<string, number>; limit?: number }) {
      let results = this.docs.filter((d) => {
        if (typeof filter.user_id === "string") return d.user_id === filter.user_id;
        if (filter.ts && typeof filter.ts === "object") {
          const gte = (filter.ts as { $gte?: string }).$gte;
          return gte === undefined || String(d.ts) >= gte;
        }
        return true; // find({})
      });
      if (options?.sort?.ts) {
        const dir = options.sort.ts;
        results = [...results].sort((a, b) =>
          dir < 0 ? String(b.ts).localeCompare(String(a.ts)) : String(a.ts).localeCompare(String(b.ts)),
        );
      }
      if (options?.limit) results = results.slice(0, options.limit);
      return { toArray: async () => results };
    }

    async insertOne(doc: Record<string, unknown>) {
      this.docs.push(doc);
      return { insertedId: doc.comic_id };
    }
  }

  class FakeDb {
    collection(name: string) {
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

const { app } = await import("../index");

// KV fake with list/get/put/delete.
let kv: Map<string, string>;
function makeAuthTokens(): Env["AUTH_TOKENS"] {
  return {
    get: async (key: string) => kv.get(key) ?? null,
    put: async (key: string, value: string) => {
      kv.set(key, value);
    },
    delete: async (key: string) => {
      kv.delete(key);
    },
    list: async () => ({
      keys: [...kv.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: "",
    }),
  } as unknown as Env["AUTH_TOKENS"];
}

const passRateLimiter = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response("ok", { status: 200 }) }),
};

let testEnv: Env;

function req(input: string, token: string, init?: RequestInit) {
  return app.request(
    input,
    { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } },
    testEnv,
  );
}

beforeEach(() => {
  comicDocs = [];
  logDocs = [];
  kv = new Map([
    ["admin-token", JSON.stringify({ user_id: "owner", role: "admin" })],
    ["user-token", JSON.stringify({ user_id: "friend", role: "user" })],
    ["legacy-token", "sigma-god"], // legacy bare-string value
  ]);
  testEnv = {
    ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
    ASTRA_DB_APPLICATION_TOKEN: "fake-token",
    ASTRA_DB_COLLECTION: "comics",
    PROCESS_LOG_COLLECTION: "process_log",
    RATE_LIMITER: passRateLimiter as unknown as Env["RATE_LIMITER"],
    USER_RATE_LIMITER: passRateLimiter as unknown as Env["USER_RATE_LIMITER"],
    AUTH_TOKENS: makeAuthTokens(),
  };
});

describe("/admin auth gating", () => {
  it("401 without a token", async () => {
    const res = await app.request("/admin/health", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("403 for a regular user token", async () => {
    const res = await req("/admin/health", "user-token");
    expect(res.status).toBe(403);
  });

  it("403 for a legacy bare-string token (role user)", async () => {
    const res = await req("/admin/users", "legacy-token");
    expect(res.status).toBe(403);
  });

  it("200 for an admin token", async () => {
    const res = await req("/admin/health", "admin-token");
    expect(res.status).toBe(200);
  });
});

describe("/admin/health", () => {
  it("reports astra ok and 24h aggregates", async () => {
    const nowIso = new Date().toISOString();
    logDocs.push({ user_id: "friend", ts: nowIso, ai_action: "created" });
    logDocs.push({ user_id: "friend", ts: nowIso, ai_action: "updated" });
    const res = await req("/admin/health", "admin-token");
    const body = (await res.json()) as {
      astra: string;
      activity_24h: { total: number; byAction: Record<string, number> };
    };
    expect(body.astra).toBe("ok");
    expect(body.activity_24h.total).toBe(2);
    expect(body.activity_24h.byAction.created).toBe(1);
    expect(body.activity_24h.byAction.updated).toBe(1);
  });
});

describe("/admin/users", () => {
  it("lists users with masked tokens and metadata only", async () => {
    comicDocs.push({ user_id: "friend", comic_id: "c1", title: "Naruto" });
    comicDocs.push({ user_id: "friend", comic_id: "c2", title: "Bleach" });
    logDocs.push({ user_id: "friend", ts: "2026-01-01T00:00:00.000Z", ai_action: "created" });

    const res = await req("/admin/users", "admin-token");
    const body = (await res.json()) as {
      users: Array<{ token_masked: string; user_id: string; comic_count: number; last_activity: string | null }>;
    };
    const friend = body.users.find((u) => u.user_id === "friend")!;
    expect(friend.comic_count).toBe(2);
    expect(friend.last_activity).toBe("2026-01-01T00:00:00.000Z");
    // No comic titles anywhere in the response.
    expect(JSON.stringify(body)).not.toContain("Naruto");
    // Full token never leaked.
    expect(JSON.stringify(body)).not.toContain("user-token");
    expect(friend.token_masked).toContain("…");
  });
});

describe("/admin/tokens", () => {
  it("creates a user-role token, returned once, stored in KV", async () => {
    const res = await req("/admin/tokens", "admin-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: "new-friend" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string; role: string };
    expect(body.role).toBe("user");
    expect(kv.get(body.token)).toBe(JSON.stringify({ user_id: "new-friend", role: "user" }));
  });

  it("400 when user_id is missing", async () => {
    const res = await req("/admin/tokens", "admin-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("revokes all user tokens for a user_id", async () => {
    // friend has a second token too — both should go.
    kv.set("user-token-2", JSON.stringify({ user_id: "friend", role: "user" }));
    const res = await req("/admin/users/friend/tokens", "admin-token", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: 2, skipped_admin: 0 });
    expect(kv.has("user-token")).toBe(false);
    expect(kv.has("user-token-2")).toBe(false);
  });

  it("404 revoking a user_id that doesn't exist", async () => {
    const res = await req("/admin/users/ghost/tokens", "admin-token", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("never deletes an admin token, even for the admin's own user_id", async () => {
    const res = await req("/admin/users/owner/tokens", "admin-token", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: 0, skipped_admin: 1 });
    expect(kv.has("admin-token")).toBe(true);
  });
});

describe("/admin/logs", () => {
  it("returns only the admin's own logs", async () => {
    logDocs.push({ user_id: "owner", ts: "2026-01-02T00:00:00.000Z", ai_action: "created", input_text: "mine", target_comic_id: null, confirmed: true });
    logDocs.push({ user_id: "friend", ts: "2026-01-02T00:00:00.000Z", ai_action: "created", input_text: "theirs", target_comic_id: null, confirmed: true });

    const res = await req("/admin/logs", "admin-token");
    const body = (await res.json()) as { logs: Array<{ input_text: string }> };
    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].input_text).toBe("mine");
  });
});
