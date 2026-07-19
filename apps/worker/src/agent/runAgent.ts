import type { Env } from "../env";
import { getComicStore } from "../store/comicStore";
import type { Content, Part } from "./geminiClient";
import { DEFAULT_GEMINI_MODEL, generateContent } from "./geminiClient";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { AGENT_TOOLS, TOOL_DECLARATIONS } from "./tools";

/** Safety net against a model that keeps calling tools forever. The real
 * longest path is 5 calls (find-similar -> create -> fetch-cover -> set-cover
 * -> log), so 10 leaves room for a retry without allowing a runaway loop. */
const MAX_TURNS = 10;

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface AgentResult {
  message: string;
  tool_calls: ToolCallRecord[];
}

/** Thrown when the model never settles on a text reply within MAX_TURNS. */
export class AgentLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentLoopError";
  }
}

function textFrom(parts: Part[]): string {
  return parts
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string" && text.trim() !== "")
    .join("\n")
    .trim();
}

/**
 * Deletes comics created earlier in a run that never finished. Best-effort:
 * a rollback failure is logged, not thrown — the original error is what the
 * user needs to see, and a stray orphan comic is a much smaller problem than
 * masking why the run actually failed.
 */
async function rollbackCreatedComics(
  env: Env,
  userId: string,
  comicIds: string[],
): Promise<void> {
  const store = getComicStore(env);
  for (const comicId of comicIds) {
    try {
      await store.deleteComic(userId, comicId);
      console.warn(`runAgent: rollback — comic ${comicId} dihapus karena run gagal di tengah`);
    } catch (err) {
      console.error(`runAgent: rollback gagal untuk comic ${comicId}: ${String(err)}`);
    }
  }
}

/**
 * Runs the comic-tracking agent to completion: ask Gemini, execute whatever
 * tools it calls, feed the results back, repeat until it answers with text.
 *
 * The user's Google API key is used per-request and never stored (SPEC.md §3).
 *
 * Tool side effects are not transactional — if the run fails partway through
 * (Gemini error, MAX_TURNS exceeded), whatever tools already ran already
 * happened. The one compensation applied here: a comic created earlier in
 * THIS run is deleted again, so a failed run never leaves an orphan comic
 * with no cover and no audit log entry. Other side effects (e.g. an
 * update_chapter that already landed) are not rolled back — the chapter
 * bump reflects something real the user reported, so keeping it is correct
 * even if the run doesn't fully finish.
 */
export async function runAgent(params: {
  env: Env;
  userId: string;
  text: string;
  apiKey: string;
  /** Optional per-request model override (user's dropdown choice). Falls back
   * to env.GEMINI_MODEL, then the built-in default. */
  model?: string;
}): Promise<AgentResult> {
  const { env, userId, text, apiKey, model } = params;
  const resolvedModel = model || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  const contents: Content[] = [{ role: "user", parts: [{ text }] }];
  const toolCalls: ToolCallRecord[] = [];
  const createdComicIds: string[] = [];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const parts = await generateContent({
        apiKey,
        model: resolvedModel,
        systemInstruction: SYSTEM_PROMPT,
        contents,
        functionDeclarations: TOOL_DECLARATIONS,
      });

      const calls = parts.filter((part) => part.functionCall);
      if (calls.length === 0) {
        return { message: textFrom(parts), tool_calls: toolCalls };
      }

      // Echo the model's turn back verbatim — Gemini requires the functionCall
      // parts to stay in history for the matching functionResponse to make sense.
      contents.push({ role: "model", parts });

      const responseParts: Part[] = [];
      for (const part of calls) {
        const call = part.functionCall!;
        const args = call.args ?? {};
        const tool = AGENT_TOOLS[call.name];

        const result = tool
          ? await tool.execute(args, { env, userId })
          : { error: `Tool tidak dikenal: ${call.name}` };

        if (
          call.name === "buat_entry_baru" &&
          result.created === true &&
          typeof result.comic_id === "string"
        ) {
          createdComicIds.push(result.comic_id);
        }

        toolCalls.push({ name: call.name, args, result });
        responseParts.push({ functionResponse: { name: call.name, response: result } });
      }

      contents.push({ role: "user", parts: responseParts });
    }

    throw new AgentLoopError(
      `Agent tidak selesai setelah ${MAX_TURNS} putaran tool — kemungkinan model terjebak memanggil tool berulang.`,
    );
  } catch (err) {
    if (createdComicIds.length > 0) {
      await rollbackCreatedComics(env, userId, createdComicIds);
    }
    throw err;
  }
}
