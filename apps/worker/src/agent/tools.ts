// The six tools the agent can call. Each entry pairs the Gemini function
// declaration with an in-process executor.
//
// These executors carry over the logic that used to live behind the
// `/internal/tools/*` HTTP endpoints (removed together with Langflow). The
// behaviour is unchanged — only the transport is gone, so there is no longer
// a shared secret, no self-fetch, and no round trip out of the Worker.
//
// Tool names are kept identical to the Langflow flow that was verified working
// in production, so the ported system prompt keeps its proven behaviour.

import type { Env } from "../env";
import type { Status, TypeTag } from "../types/comic";
import { TYPE_TAGS, STATUSES } from "../types/comic";
import type { AiAction } from "../types/processLog";
import { AI_ACTIONS } from "../types/processLog";
import { getComicStore } from "../store/comicStore";
import { getProcessLogStore } from "../store/processLogStore";
import { acquireMangaDexSlot } from "../durable-objects/RateLimiter";
import { fetchMangaDexCover } from "../lib/mangadex";
import type { FunctionDeclaration } from "./geminiClient";

export interface ToolContext {
  env: Env;
  userId: string;
}

/** Tool results are handed straight back to the model as a functionResponse,
 * so failures are returned as `{ error }` data rather than thrown — that lets
 * the model explain the problem to the user instead of the run dying. */
type ToolResult = Record<string, unknown>;

export interface AgentTool {
  declaration: FunctionDeclaration;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

// --- arg coercion ------------------------------------------------------------
// The schema `enum`s make malformed values very unlikely, but the model is
// still an untrusted input source, so every arg is validated before use.

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/** Optional `status`: absent/empty means "let the caller apply its default". */
function asStatus(value: unknown): Status | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && STATUSES.includes(value as Status)
    ? (value as Status)
    : "invalid";
}

// --- tools -------------------------------------------------------------------

const cariKomikMirip: AgentTool = {
  declaration: {
    name: "cari_komik_mirip",
    description:
      "Cari komik yang mirip dengan judul kandidat. WAJIB dipanggil sebelum tool create/update lain — jangan menebak sendiri kecocokan judul.",
    parameters: {
      type: "OBJECT",
      properties: {
        candidate_title: {
          type: "STRING",
          description: "Judul komik hasil ekstraksi dari teks user",
        },
      },
      required: ["candidate_title"],
    },
  },
  async execute(args, ctx) {
    const candidateTitle = asString(args.candidate_title);
    if (!candidateTitle) return { error: "candidate_title wajib diisi" };

    const candidates = await getComicStore(ctx.env).searchComics(ctx.userId, candidateTitle);
    return { candidates };
  },
};

const buatEntryBaru: AgentTool = {
  declaration: {
    name: "buat_entry_baru",
    description:
      "Buat entry komik baru. Hanya panggil kalau cari_komik_mirip tidak menemukan kecocokan (skor < 0.5).",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Judul komik" },
        type_tag: {
          type: "STRING",
          description: "Jenis komik",
          enum: [...TYPE_TAGS],
        },
        is_adult: {
          type: "BOOLEAN",
          description: "Status 18+. Field terpisah — jangan digabung ke type_tag.",
        },
        chapter: { type: "NUMBER", description: "Chapter terakhir dibaca (boleh desimal)" },
        status: {
          type: "STRING",
          description: "Kosongkan kalau user tidak menyebutkan status. Default: ongoing.",
          enum: [...STATUSES],
        },
      },
      required: ["title", "type_tag", "is_adult", "chapter"],
    },
  },
  async execute(args, ctx) {
    const title = asString(args.title);
    if (!title) return { error: "title wajib diisi" };

    const typeTag = asString(args.type_tag);
    if (!typeTag || !TYPE_TAGS.includes(typeTag as TypeTag)) {
      return { error: `type_tag harus salah satu dari: ${TYPE_TAGS.join(", ")}` };
    }

    const isAdult = asBoolean(args.is_adult);
    if (isAdult === null) return { error: "is_adult wajib boolean" };

    const chapter = asNumber(args.chapter);
    if (chapter === null) return { error: "chapter wajib angka" };

    const status = asStatus(args.status);
    if (status === "invalid") {
      return { error: `status harus salah satu dari: ${STATUSES.join(", ")}, atau dikosongkan` };
    }

    const now = new Date().toISOString();
    const comic = {
      comic_id: crypto.randomUUID(),
      title,
      aliases: [],
      type_tag: typeTag as TypeTag,
      is_adult: isAdult,
      latest_chapter: chapter,
      status: status ?? ("ongoing" as Status),
      cover_url: null,
      created_at: now,
      updated_at: now,
    };

    await getComicStore(ctx.env).insertComic(ctx.userId, comic);
    return { comic_id: comic.comic_id, created: true };
  },
};

const updateChapter: AgentTool = {
  declaration: {
    name: "update_chapter",
    description: "Update chapter komik yang sudah ada (comic_id dari hasil cari_komik_mirip).",
    parameters: {
      type: "OBJECT",
      properties: {
        comic_id: { type: "STRING", description: "comic_id dari hasil cari_komik_mirip" },
        chapter: { type: "NUMBER", description: "Chapter terbaru (boleh desimal)" },
        status: {
          type: "STRING",
          description: "Kosongkan kalau user tidak menyebutkan perubahan status.",
          enum: [...STATUSES],
        },
      },
      required: ["comic_id", "chapter"],
    },
  },
  async execute(args, ctx) {
    const comicId = asString(args.comic_id);
    if (!comicId) return { error: "comic_id wajib diisi" };

    const chapter = asNumber(args.chapter);
    if (chapter === null) return { error: "chapter wajib angka" };

    const status = asStatus(args.status);
    if (status === "invalid") {
      return { error: `status harus salah satu dari: ${STATUSES.join(", ")}, atau dikosongkan` };
    }

    const store = getComicStore(ctx.env);
    const existing = await store.findComic(ctx.userId, comicId);
    if (!existing) return { error: "comic tidak ditemukan" };

    const patch: { latest_chapter: number; status?: Status } = { latest_chapter: chapter };
    if (status !== null) patch.status = status;

    await store.updateComic(ctx.userId, comicId, patch);
    return { comic_id: comicId, updated: true, previous_chapter: existing.latest_chapter };
  },
};

const cariCoverMangadex: AgentTool = {
  declaration: {
    name: "cari_cover_mangadex",
    description:
      "Cari cover komik dari MangaDex. Hanya MENCARI URL-nya, TIDAK menyimpan — panggil set_cover setelahnya kalau hasilnya tidak null.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Judul komik untuk dicari covernya" },
      },
      required: ["title"],
    },
  },
  async execute(args, ctx) {
    const title = asString(args.title);
    if (!title) return { error: "title wajib diisi" };

    // Global <=5 req/s throttle across the whole Worker (MangaDex limits per IP,
    // not per user), so this queues briefly rather than failing.
    await acquireMangaDexSlot(ctx.env.RATE_LIMITER);
    return { cover_url: await fetchMangaDexCover(title) };
  },
};

const setCover: AgentTool = {
  declaration: {
    name: "set_cover",
    description:
      "Simpan cover_url hasil cari_cover_mangadex ke comic. WAJIB dipanggil setelah cari_cover_mangadex mengembalikan cover_url yang tidak null — tanpa ini cover tidak akan pernah tersimpan.",
    parameters: {
      type: "OBJECT",
      properties: {
        comic_id: { type: "STRING", description: "comic_id hasil buat_entry_baru" },
        cover_url: { type: "STRING", description: "URL cover dari cari_cover_mangadex" },
      },
      required: ["comic_id", "cover_url"],
    },
  },
  async execute(args, ctx) {
    const comicId = asString(args.comic_id);
    if (!comicId) return { error: "comic_id wajib diisi" };

    const coverUrl = asString(args.cover_url);
    if (!coverUrl) return { error: "cover_url wajib diisi" };

    const store = getComicStore(ctx.env);
    if (!(await store.findComic(ctx.userId, comicId))) {
      return { error: "comic tidak ditemukan" };
    }

    await store.updateComic(ctx.userId, comicId, { cover_url: coverUrl });
    return { comic_id: comicId, updated: true };
  },
};

const logProses: AgentTool = {
  declaration: {
    name: "log_proses",
    description:
      "WAJIB dipanggil di akhir, di SETIAP cabang (created/updated/ambiguous) — audit trail.",
    parameters: {
      type: "OBJECT",
      properties: {
        input_text: { type: "STRING", description: "Teks asli user, apa adanya" },
        ai_action: {
          type: "STRING",
          description: "Aksi yang barusan dilakukan",
          enum: [...AI_ACTIONS],
        },
        target_comic_id: {
          type: "STRING",
          description: "comic_id yang dibuat/diupdate. Kosongkan kalau ambiguous.",
        },
        confirmed: {
          type: "BOOLEAN",
          description: "true kalau langsung dieksekusi, false kalau menunggu pilihan user",
        },
      },
      required: ["input_text", "ai_action", "confirmed"],
    },
  },
  async execute(args, ctx) {
    const inputText = asString(args.input_text);
    if (!inputText) return { error: "input_text wajib diisi" };

    const aiAction = asString(args.ai_action);
    if (!aiAction || !AI_ACTIONS.includes(aiAction as AiAction)) {
      return { error: `ai_action harus salah satu dari: ${AI_ACTIONS.join(", ")}` };
    }

    const confirmed = asBoolean(args.confirmed);
    if (confirmed === null) return { error: "confirmed wajib boolean" };

    await getProcessLogStore(ctx.env).insertLog(ctx.userId, {
      input_text: inputText,
      ai_action: aiAction as AiAction,
      target_comic_id: asString(args.target_comic_id),
      confirmed,
    });
    return { logged: true };
  },
};

export const AGENT_TOOLS: Record<string, AgentTool> = {
  [cariKomikMirip.declaration.name]: cariKomikMirip,
  [buatEntryBaru.declaration.name]: buatEntryBaru,
  [updateChapter.declaration.name]: updateChapter,
  [cariCoverMangadex.declaration.name]: cariCoverMangadex,
  [setCover.declaration.name]: setCover,
  [logProses.declaration.name]: logProses,
};

export const TOOL_DECLARATIONS: FunctionDeclaration[] = Object.values(AGENT_TOOLS).map(
  (tool) => tool.declaration,
);
