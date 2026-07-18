import { Hono } from "hono";
import type { Env } from "../env";
import type { Status, TypeTag } from "../types/comic";
import { TYPE_TAGS, STATUSES } from "../types/comic";
import { AI_ACTIONS } from "../types/processLog";
import type { AiAction } from "../types/processLog";
import { getComicStore } from "../store/comicStore";
import { getProcessLogStore } from "../store/processLogStore";
import { internalAuth } from "../middleware/internalAuth";
import { acquireMangaDexSlot } from "../durable-objects/RateLimiter";
import { fetchMangaDexCover } from "../lib/mangadex";

type Bindings = { Bindings: Env; Variables: { userId: string } };

export const internalTools = new Hono<Bindings>();
internalTools.use("*", internalAuth);

// --- find-similar (cari_komik_mirip) ---------------------------------------

interface FindSimilarBody {
  candidate_title?: unknown;
}

internalTools.post("/find-similar", async (c) => {
  const body = await c.req.json<FindSimilarBody>().catch(() => ({}) as FindSimilarBody);
  if (typeof body.candidate_title !== "string" || body.candidate_title.trim() === "") {
    return c.json({ error: "candidate_title wajib diisi" }, 400);
  }

  const store = getComicStore(c.env);
  const candidates = await store.searchComics(c.get("userId"), body.candidate_title);
  return c.json({ candidates });
});

// --- create-comic (buat_entry_baru) -----------------------------------------

interface CreateComicBody {
  title?: unknown;
  type_tag?: unknown;
  is_adult?: unknown;
  chapter?: unknown;
  status?: unknown;
}

function validateCreateComicBody(body: CreateComicBody): string | null {
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return "title wajib diisi";
  }
  if (typeof body.type_tag !== "string" || !TYPE_TAGS.includes(body.type_tag as TypeTag)) {
    return `type_tag harus salah satu dari: ${TYPE_TAGS.join(", ")}`;
  }
  if (typeof body.is_adult !== "boolean") {
    return "is_adult wajib boolean";
  }
  if (typeof body.chapter !== "number" || Number.isNaN(body.chapter)) {
    return "chapter wajib angka";
  }
  if (body.status !== null && body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as Status)) {
      return `status harus salah satu dari: ${STATUSES.join(", ")}, atau null`;
    }
  }
  return null;
}

internalTools.post("/create-comic", async (c) => {
  const body = await c.req.json<CreateComicBody>().catch(() => ({}) as CreateComicBody);
  const error = validateCreateComicBody(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const now = new Date().toISOString();
  const comic = {
    comic_id: crypto.randomUUID(),
    title: body.title as string,
    aliases: [],
    type_tag: body.type_tag as TypeTag,
    is_adult: body.is_adult as boolean,
    latest_chapter: body.chapter as number,
    status: (body.status as Status | null | undefined) ?? "ongoing",
    cover_url: null,
    created_at: now,
    updated_at: now,
  };

  const store = getComicStore(c.env);
  await store.insertComic(c.get("userId"), comic);
  return c.json({ comic_id: comic.comic_id, created: true });
});

// --- update-chapter -----------------------------------------------------------

interface UpdateChapterBody {
  comic_id?: unknown;
  chapter?: unknown;
  status?: unknown;
}

function validateUpdateChapterBody(body: UpdateChapterBody): string | null {
  if (typeof body.comic_id !== "string" || body.comic_id.trim() === "") {
    return "comic_id wajib diisi";
  }
  if (typeof body.chapter !== "number" || Number.isNaN(body.chapter)) {
    return "chapter wajib angka";
  }
  if (body.status !== null && body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status as Status)) {
      return `status harus salah satu dari: ${STATUSES.join(", ")}, atau null`;
    }
  }
  return null;
}

internalTools.post("/update-chapter", async (c) => {
  const body = await c.req.json<UpdateChapterBody>().catch(() => ({}) as UpdateChapterBody);
  const error = validateUpdateChapterBody(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const store = getComicStore(c.env);
  const userId = c.get("userId");
  const comicId = body.comic_id as string;

  const existing = await store.findComic(userId, comicId);
  if (!existing) {
    return c.json({ error: "comic tidak ditemukan" }, 404);
  }

  const patch: { latest_chapter: number; status?: Status } = {
    latest_chapter: body.chapter as number,
  };
  if (body.status !== null && body.status !== undefined) {
    patch.status = body.status as Status;
  }

  await store.updateComic(userId, comicId, patch);
  return c.json({
    comic_id: comicId,
    updated: true,
    previous_chapter: existing.latest_chapter,
  });
});

// --- fetch-cover (cari_cover_mangadex) ---------------------------------------

interface FetchCoverBody {
  title?: unknown;
}

internalTools.post("/fetch-cover", async (c) => {
  const body = await c.req.json<FetchCoverBody>().catch(() => ({}) as FetchCoverBody);
  if (typeof body.title !== "string" || body.title.trim() === "") {
    return c.json({ error: "title wajib diisi" }, 400);
  }

  await acquireMangaDexSlot(c.env.RATE_LIMITER);
  const cover_url = await fetchMangaDexCover(body.title);
  return c.json({ cover_url });
});

// --- set-cover (set_cover) ---------------------------------------------------

interface SetCoverBody {
  comic_id?: unknown;
  cover_url?: unknown;
}

function validateSetCoverBody(body: SetCoverBody): string | null {
  if (typeof body.comic_id !== "string" || body.comic_id.trim() === "") {
    return "comic_id wajib diisi";
  }
  if (typeof body.cover_url !== "string" || body.cover_url.trim() === "") {
    return "cover_url wajib diisi";
  }
  return null;
}

internalTools.post("/set-cover", async (c) => {
  const body = await c.req.json<SetCoverBody>().catch(() => ({}) as SetCoverBody);
  const error = validateSetCoverBody(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const store = getComicStore(c.env);
  const userId = c.get("userId");
  const comicId = body.comic_id as string;

  if (!(await store.findComic(userId, comicId))) {
    return c.json({ error: "comic tidak ditemukan" }, 404);
  }

  await store.updateComic(userId, comicId, { cover_url: body.cover_url as string });
  return c.json({ comic_id: comicId, updated: true });
});

// --- log-process (log_proses) -------------------------------------------------

interface LogProcessBody {
  input_text?: unknown;
  ai_action?: unknown;
  target_comic_id?: unknown;
  confirmed?: unknown;
}

function validateLogProcessBody(body: LogProcessBody): string | null {
  if (typeof body.input_text !== "string" || body.input_text.trim() === "") {
    return "input_text wajib diisi";
  }
  if (typeof body.ai_action !== "string" || !AI_ACTIONS.includes(body.ai_action as AiAction)) {
    return `ai_action harus salah satu dari: ${AI_ACTIONS.join(", ")}`;
  }
  if (body.target_comic_id !== null && typeof body.target_comic_id !== "string") {
    return "target_comic_id harus string atau null";
  }
  if (typeof body.confirmed !== "boolean") {
    return "confirmed wajib boolean";
  }
  return null;
}

internalTools.post("/log-process", async (c) => {
  const body = await c.req.json<LogProcessBody>().catch(() => ({}) as LogProcessBody);
  const error = validateLogProcessBody(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const store = getProcessLogStore(c.env);
  await store.insertLog(c.get("userId"), {
    input_text: body.input_text as string,
    ai_action: body.ai_action as AiAction,
    target_comic_id: body.target_comic_id as string | null,
    confirmed: body.confirmed as boolean,
  });
  return c.json({ logged: true });
});
