import { beforeEach, describe, expect, it } from "vitest";
import app from "../index";
import { resetStore } from "../store/comicStore";
import type { Comic } from "../types/comic";

describe("/comics", () => {
  beforeEach(() => {
    resetStore();
  });

  it("lists no comics initially", async () => {
    const res = await app.request("/comics");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("rejects an invalid create body", async () => {
    const res = await app.request("/comics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates then lists a comic", async () => {
    const createRes = await app.request("/comics", {
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

    const listRes = await app.request("/comics");
    const list = (await listRes.json()) as Comic[];
    expect(list).toHaveLength(1);
    expect(list[0].comic_id).toBe(created.comic_id);
  });

  it("returns 404 when patching a missing comic", async () => {
    const res = await app.request("/comics/missing-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latest_chapter: 2 }),
    });
    expect(res.status).toBe(404);
  });

  it("patches an existing comic", async () => {
    const createRes = await app.request("/comics", {
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

    const patchRes = await app.request(`/comics/${created.comic_id}`, {
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
