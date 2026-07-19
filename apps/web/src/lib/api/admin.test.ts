import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToken, fetchAdminUsers, revokeUserAccess } from "./admin";

function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  const storage = fakeLocalStorage();
  storage.setItem("komik-tracker:auth-token", "admin-token");
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(response: Response) {
  return vi.fn(async (...args: [string, RequestInit?]) => {
    void args;
    return response;
  });
}

describe("admin api", () => {
  it("attaches Authorization header on fetchAdminUsers", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ users: [], list_complete: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchAdminUsers();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer admin-token" });
  });

  it("createToken posts user_id and returns the token", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ token: "abc123", user_id: "budi", role: "user" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createToken("budi");
    expect(result.token).toBe("abc123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/tokens");
    expect(JSON.parse(init?.body as string)).toEqual({ user_id: "budi" });
  });

  it("revokeUserAccess DELETEs by user_id", async () => {
    const fetchMock = mockFetch(
      new Response(JSON.stringify({ revoked: 1, skipped_admin: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await revokeUserAccess("budi");
    expect(result.revoked).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/users/budi/tokens");
    expect(init?.method).toBe("DELETE");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", mockFetch(new Response(JSON.stringify({ error: "boom" }), { status: 500 })));
    await expect(fetchAdminUsers()).rejects.toThrow();
  });
});
