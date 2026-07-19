import { Hono } from "hono";
import type { Env } from "../env";
import type { Comic, Status, TypeTag } from "../types/comic";
import { TYPE_TAGS, STATUSES } from "../types/comic";
import { getComicStore } from "../store/comicStore";
import { rankCandidates } from "../store/fuzzyMatch";
import { userAuth } from "../middleware/userAuth";
import { rateLimit } from "../middleware/rateLimit";
import type { Role } from "../lib/authValue";
import { fetchComicInfo } from "../lib/comicInfo";

// Deterministic import path (no AI): score >= this means "same comic", so the
// entry updates latest_chapter instead of creating a duplicate. Chosen higher
// than the agent's ambiguity band since bulk import has no human in the loop
// to resolve a borderline match.
const BULK_MATCH_THRESHOLD = 0.85;

// Cloudflare Workers cap subrequests per invocation (50 on the free plan).
// Each written comic and each MangaDex lookup is one subrequest, so chunk
// sizes are capped well under that ceiling.
const MAX_BULK_ENTRIES = 25;
const MAX_BULK_DELETE = 25;
// Each item can now hit BOTH MangaDex and AniList (2 throttle + 2 fetch
// subrequests) plus Astra reads/writes, so caps sit lower than before.
const MAX_COVER_BACKFILL = 6;
const MAX_DETECT_TITLES = 8;

/** Free-form user note. Bounded so a stray paste can't blow the Astra 8000-byte
 * indexed-field limit. */
const MAX_NOTE_LENGTH = 500;

function isValidNote(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_NOTE_LENGTH;
}

interface CreateComicBody {
  title?: unknown;
  aliases?: unknown;
  type_tag?: unknown;
  is_adult?: unknown;
  latest_chapter?: unknown;
  status?: unknown;
  cover_url?: unknown;
  read_url?: unknown;
  release_day?: unknown;
  note?: unknown;
}

// http/https only — this value gets rendered as <a href> on the client, so a
// javascript: scheme would be a stored-XSS vector.
function isValidReadUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidReleaseDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
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
  if (body.read_url !== undefined && body.read_url !== null && !isValidReadUrl(body.read_url)) {
    return "read_url harus URL http/https, string kosong, atau null";
  }
  if (body.release_day !== undefined && body.release_day !== null && !isValidReleaseDay(body.release_day)) {
    return "release_day harus angka 0-6 atau null";
  }
  if (body.note !== undefined && body.note !== null && !isValidNote(body.note)) {
    return `note harus string maksimal ${MAX_NOTE_LENGTH} karakter atau null`;
  }
  return null;
}

export const comics = new Hono<{ Bindings: Env; Variables: { userId: string; role: Role } }>();

comics.use("*", userAuth, rateLimit);

comics.get("/", async (c) => {
  const store = getComicStore(c.env);
  return c.json(await store.listComics(c.get("userId")));
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
    read_url: (body.read_url as string | null | undefined) || null,
    release_day: (body.release_day as number | null | undefined) ?? null,
    note: (body.note as string | null | undefined)?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  const store = getComicStore(c.env);
  try {
    await store.insertComic(c.get("userId"), comic);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Gagal menyimpan komik: ${message}` }, 500);
  }
  return c.json(comic, 201);
});

interface BulkEntry {
  title?: unknown;
  type_tag?: unknown;
  is_adult?: unknown;
  latest_chapter?: unknown;
  status?: unknown;
  note?: unknown;
}

interface BulkResultItem {
  title: string;
  action: "created" | "updated" | "skipped" | "error";
  comic_id?: string;
  reason?: string;
}

function validateBulkEntry(body: BulkEntry): string | null {
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
  if (body.note !== undefined && body.note !== null && !isValidNote(body.note)) {
    return `note harus string maksimal ${MAX_NOTE_LENGTH} karakter atau null`;
  }
  return null;
}

// Deterministic bulk import from historical text data (SPEC.md §7) — no AI
// involved, so it doesn't touch Gemini quota. See apps/web/src/lib/parseHistoris.ts
// for the client-side parser that produces these entries.
comics.post("/bulk", async (c) => {
  const body = await c.req
    .json<{ entries?: unknown }>()
    .catch(() => ({}) as { entries?: unknown });
  if (!Array.isArray(body.entries)) {
    return c.json({ error: "entries harus array" }, 400);
  }
  if (body.entries.length === 0) {
    return c.json({ error: "entries tidak boleh kosong" }, 400);
  }
  if (body.entries.length > MAX_BULK_ENTRIES) {
    return c.json({ error: `entries maksimal ${MAX_BULK_ENTRIES} per request` }, 400);
  }

  const userId = c.get("userId");
  const store = getComicStore(c.env);
  // Fetch the existing list once for the whole chunk and match in memory —
  // calling searchComics() per entry would multiply subrequests against Astra.
  const existing = await store.listComics(userId);

  const results: BulkResultItem[] = [];

  for (const rawEntry of body.entries as BulkEntry[]) {
    const error = validateBulkEntry(rawEntry);
    if (error) {
      results.push({ title: typeof rawEntry.title === "string" ? rawEntry.title : "?", action: "error", reason: error });
      continue;
    }

    const entry = {
      title: rawEntry.title as string,
      type_tag: rawEntry.type_tag as TypeTag,
      is_adult: rawEntry.is_adult as boolean,
      latest_chapter: rawEntry.latest_chapter as number,
      status: rawEntry.status as Status,
      note: (rawEntry.note as string | null | undefined)?.trim() || null,
    };

    const [best] = rankCandidates(existing, entry.title, 1);

    try {
      if (best && best.score >= BULK_MATCH_THRESHOLD) {
        const match = existing.find((c) => c.comic_id === best.comic_id)!;
        if (entry.latest_chapter > match.latest_chapter) {
          const updated = await store.updateComic(userId, match.comic_id, {
            latest_chapter: entry.latest_chapter,
            status: entry.status,
          });
          if (updated) {
            match.latest_chapter = updated.latest_chapter;
            match.status = updated.status;
          }
          results.push({ title: entry.title, action: "updated", comic_id: match.comic_id });
        } else {
          results.push({
            title: entry.title,
            action: "skipped",
            comic_id: match.comic_id,
            reason: "chapter impor tidak lebih tinggi dari yang tersimpan",
          });
        }
        continue;
      }

      const now = new Date().toISOString();
      const comic: Comic = {
        comic_id: crypto.randomUUID(),
        title: entry.title,
        aliases: [],
        type_tag: entry.type_tag,
        is_adult: entry.is_adult,
        latest_chapter: entry.latest_chapter,
        status: entry.status,
        cover_url: null,
        read_url: null,
        release_day: null,
        note: entry.note,
        created_at: now,
        updated_at: now,
      };
      await store.insertComic(userId, comic);
      existing.push(comic);
      results.push({ title: entry.title, action: "created", comic_id: comic.comic_id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ title: entry.title, action: "error", reason: message });
    }
  }

  return c.json({ results });
});

// Delete many comics at once. Per-item result so an id that's already gone
// (e.g. deleted in another tab) doesn't fail the whole batch. Reuses the
// existing store.deleteComic — no new repository method.
comics.post("/bulk-delete", async (c) => {
  const body = await c.req
    .json<{ comic_ids?: unknown }>()
    .catch(() => ({}) as { comic_ids?: unknown });
  if (
    !Array.isArray(body.comic_ids) ||
    body.comic_ids.some((id: unknown) => typeof id !== "string")
  ) {
    return c.json({ error: "comic_ids harus array of string" }, 400);
  }
  if (body.comic_ids.length === 0) {
    return c.json({ error: "comic_ids tidak boleh kosong" }, 400);
  }
  if (body.comic_ids.length > MAX_BULK_DELETE) {
    return c.json({ error: `comic_ids maksimal ${MAX_BULK_DELETE} per request` }, 400);
  }

  const userId = c.get("userId");
  const store = getComicStore(c.env);
  const results: Array<{ comic_id: string; deleted: boolean }> = [];

  for (const comicId of body.comic_ids as string[]) {
    const deleted = await store.deleteComic(userId, comicId);
    results.push({ comic_id: comicId, deleted });
  }

  return c.json({ results });
});

// Second pass: fetch covers (MangaDex, AniList fallback) for comics created by bulk import
// (which always start with cover_url: null). Kept separate from /bulk itself
// so cover lookups don't compete with comic writes for the subrequest budget.
comics.post("/backfill-covers", async (c) => {
  const body = await c.req
    .json<{ comic_ids?: unknown }>()
    .catch(() => ({}) as { comic_ids?: unknown });
  if (
    !Array.isArray(body.comic_ids) ||
    body.comic_ids.some((id: unknown) => typeof id !== "string")
  ) {
    return c.json({ error: "comic_ids harus array of string" }, 400);
  }
  if (body.comic_ids.length === 0) {
    return c.json({ error: "comic_ids tidak boleh kosong" }, 400);
  }
  if (body.comic_ids.length > MAX_COVER_BACKFILL) {
    return c.json({ error: `comic_ids maksimal ${MAX_COVER_BACKFILL} per request` }, 400);
  }

  const userId = c.get("userId");
  const store = getComicStore(c.env);
  const results: Array<{ comic_id: string; cover_url: string | null; reason?: string }> = [];

  for (const comicId of body.comic_ids as string[]) {
    const comic = await store.findComic(userId, comicId);
    if (!comic) {
      results.push({ comic_id: comicId, cover_url: null, reason: "comic tidak ditemukan" });
      continue;
    }

    const info = await fetchComicInfo(comic.title, c.env);
    const coverUrl = info?.cover_url ?? null;
    if (coverUrl) {
      await store.updateComic(userId, comicId, { cover_url: coverUrl });
    }
    results.push({ comic_id: comicId, cover_url: coverUrl, reason: coverUrl ? undefined : "tidak ditemukan di MangaDex maupun AniList" });
  }

  return c.json({ results });
});

// Auto-detect comic type from MangaDex (AniList fallback) for import lines where the user didn't
// write (jenis). Type only — is_adult is NEVER auto-detected (SPEC.md §8: 18+
// must be explicit from the user, not a system guess). Returns type_tag: null
// when no confident match / unmapped language, so the UI can flag the line
// instead of storing a guess. Does not touch comic data — placed under /comics
// only to reuse the auth + rate-limit middleware.
comics.post("/detect-type", async (c) => {
  const body = await c.req
    .json<{ titles?: unknown }>()
    .catch(() => ({}) as { titles?: unknown });
  if (!Array.isArray(body.titles) || body.titles.some((t: unknown) => typeof t !== "string")) {
    return c.json({ error: "titles harus array of string" }, 400);
  }
  if (body.titles.length === 0) {
    return c.json({ error: "titles tidak boleh kosong" }, 400);
  }
  if (body.titles.length > MAX_DETECT_TITLES) {
    return c.json({ error: `titles maksimal ${MAX_DETECT_TITLES} per request` }, 400);
  }

  const results: Array<{ title: string; type_tag: TypeTag | null; reason?: string }> = [];
  for (const title of body.titles as string[]) {
    const info = await fetchComicInfo(title, c.env);
    if (!info) {
      results.push({ title, type_tag: null, reason: "tidak ditemukan di MangaDex maupun AniList" });
    } else if (!info.type_tag) {
      results.push({ title, type_tag: null, reason: "jenis tidak dikenali dari bahasa/negara asal" });
    } else {
      results.push({ title, type_tag: info.type_tag });
    }
  }

  return c.json({ results });
});

comics.patch("/:id", async (c) => {
  const store = getComicStore(c.env);
  const id = c.req.param("id");
  if (!(await store.findComic(c.get("userId"), id))) {
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
  if (body.read_url !== undefined) {
    if (body.read_url !== null && !isValidReadUrl(body.read_url)) {
      return c.json({ error: "read_url harus URL http/https, string kosong, atau null" }, 400);
    }
    patch.read_url = (body.read_url as string | null) || null;
  }
  if (body.release_day !== undefined) {
    if (body.release_day !== null && !isValidReleaseDay(body.release_day)) {
      return c.json({ error: "release_day harus angka 0-6 atau null" }, 400);
    }
    patch.release_day = body.release_day as number | null;
  }
  if (body.note !== undefined) {
    if (body.note !== null && !isValidNote(body.note)) {
      return c.json({ error: `note harus string maksimal ${MAX_NOTE_LENGTH} karakter atau null` }, 400);
    }
    patch.note = (body.note as string | null)?.trim() || null;
  }

  try {
    const updated = await store.updateComic(c.get("userId"), id, patch);
    return c.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Gagal menyimpan komik: ${message}` }, 500);
  }
});

comics.delete("/:id", async (c) => {
  const store = getComicStore(c.env);
  const deleted = await store.deleteComic(c.get("userId"), c.req.param("id"));
  if (!deleted) {
    return c.json({ error: "comic tidak ditemukan" }, 404);
  }
  return c.body(null, 204);
});
