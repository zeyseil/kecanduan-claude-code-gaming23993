import { Hono } from "hono";
import type { Comic, Status, TypeTag } from "../types/comic";
import { TYPE_TAGS, STATUSES } from "../types/comic";
import { findComic, insertComic, listComics, updateComic } from "../store/comicStore";

// Auth is deferred — every request acts on this fixed demo user.
const DEMO_USER_ID = "demo-user";

interface CreateComicBody {
  title?: unknown;
  aliases?: unknown;
  type_tag?: unknown;
  is_adult?: unknown;
  latest_chapter?: unknown;
  status?: unknown;
  cover_url?: unknown;
}

function validateCreateBody(body: CreateComicBody): string | null {
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return "title wajib diisi";
  }
  if (typeof body.type_tag !== "string" || !TYPE_TAGS.includes(body.type_tag as TypeTag)) {
    return `type_tag harus salah satu dari: ${TYPE_TAGS.join(", ")}`;
  }
  if (typeof body.is_adult !== "boolean") {
    return "is_adult wajib boolean";
  }
  if (typeof body.latest_chapter !== "number" || Number.isNaN(body.latest_chapter)) {
    return "latest_chapter wajib angka";
  }
  if (typeof body.status !== "string" || !STATUSES.includes(body.status as Status)) {
    return `status harus salah satu dari: ${STATUSES.join(", ")}`;
  }
  if (body.aliases !== undefined && !Array.isArray(body.aliases)) {
    return "aliases harus array of string";
  }
  if (body.cover_url !== undefined && body.cover_url !== null && typeof body.cover_url !== "string") {
    return "cover_url harus string atau null";
  }
  return null;
}

export const comics = new Hono();

comics.get("/", (c) => {
  return c.json(listComics(DEMO_USER_ID));
});

comics.post("/", async (c) => {
  const body = await c.req.json<CreateComicBody>().catch(() => ({}) as CreateComicBody);
  const error = validateCreateBody(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const now = new Date().toISOString();
  const comic: Comic = {
    comic_id: crypto.randomUUID(),
    title: body.title as string,
    aliases: (body.aliases as string[] | undefined) ?? [],
    type_tag: body.type_tag as TypeTag,
    is_adult: body.is_adult as boolean,
    latest_chapter: body.latest_chapter as number,
    status: body.status as Status,
    cover_url: (body.cover_url as string | null | undefined) ?? null,
    created_at: now,
    updated_at: now,
  };

  insertComic(DEMO_USER_ID, comic);
  return c.json(comic, 201);
});

comics.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!findComic(DEMO_USER_ID, id)) {
    return c.json({ error: "comic tidak ditemukan" }, 404);
  }

  const body = await c.req
    .json<Partial<CreateComicBody>>()
    .catch(() => ({}) as Partial<CreateComicBody>);
  const patch: Partial<Comic> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return c.json({ error: "title tidak valid" }, 400);
    }
    patch.title = body.title;
  }
  if (body.aliases !== undefined) {
    if (!Array.isArray(body.aliases)) {
      return c.json({ error: "aliases harus array of string" }, 400);
    }
    patch.aliases = body.aliases as string[];
  }
  if (body.type_tag !== undefined) {
    if (typeof body.type_tag !== "string" || !TYPE_TAGS.includes(body.type_tag as TypeTag)) {
      return c.json({ error: `type_tag harus salah satu dari: ${TYPE_TAGS.join(", ")}` }, 400);
    }
    patch.type_tag = body.type_tag as TypeTag;
  }
  if (body.is_adult !== undefined) {
    if (typeof body.is_adult !== "boolean") {
      return c.json({ error: "is_adult harus boolean" }, 400);
    }
    patch.is_adult = body.is_adult;
  }
  if (body.latest_chapter !== undefined) {
    if (typeof body.latest_chapter !== "number" || Number.isNaN(body.latest_chapter)) {
      return c.json({ error: "latest_chapter harus angka" }, 400);
    }
    patch.latest_chapter = body.latest_chapter;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as Status)) {
      return c.json({ error: `status harus salah satu dari: ${STATUSES.join(", ")}` }, 400);
    }
    patch.status = body.status as Status;
  }
  if (body.cover_url !== undefined) {
    if (body.cover_url !== null && typeof body.cover_url !== "string") {
      return c.json({ error: "cover_url harus string atau null" }, 400);
    }
    patch.cover_url = body.cover_url as string | null;
  }

  const updated = updateComic(DEMO_USER_ID, id, patch);
  return c.json(updated);
});
