// Thin wrapper over the Gemini `generateContent` REST API.
//
// `generateContent` is Google's stateless endpoint: the full conversation is
// sent on every call, so nothing depends on server-side session state. That
// makes the tool-calling loop trivial to test (mock `fetch`, assert the
// `contents` array). Google now labels it "legacy" in favour of the newer
// Interactions API — migrating later means rewriting this one file, which is
// why the whole Gemini surface is deliberately confined here.

/** Subset of the Gemini OpenAPI-style Schema we actually use. */
export interface GeminiSchema {
  type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";
  description?: string;
  /** Allowed literal values — this is what structurally prevents the model
   * from inventing synonyms like "finished" instead of "completed". */
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: GeminiSchema;
}

export interface FunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface Part {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

export interface Content {
  role: "user" | "model";
  parts: Part[];
}

interface GenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Part[] } }>;
}

/** Thrown when Gemini itself is unreachable or rejects the request. */
export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

// `-latest` is a stable alias Google maintains, so a model rename doesn't
// break us. Flash-Lite specifically, for a reason found during end-to-end
// testing: the free tier caps requests *per model per day* (20/day for
// gemini-3.5-flash, which `gemini-flash-latest` resolves to). One agent run
// costs 4-6 requests because every tool-calling turn is its own request, so
// that cap allows only ~3-5 runs/day. Flash-Lite has its own separate quota
// and is more than capable of this task (structured extraction + tool
// selection, not deep reasoning). Override via env.GEMINI_MODEL.
export const DEFAULT_GEMINI_MODEL = "gemini-flash-lite-latest";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Gemini's free Flash tier returns 503 "experiencing high demand" fairly often —
// observed repeatedly during end-to-end testing. Without retries a single blip
// aborts the whole agent run, and because tool side effects are NOT rolled back,
// that can leave a comic created but its cover never fetched. Retrying here is
// the cheapest way to keep a run whole.
//
// 429 is deliberately NOT retried: it means the daily free-tier quota is gone,
// and Google's own RetryInfo asks for ~57s — far beyond a sensible in-request
// backoff. Retrying would just stall the user before failing anyway.
// Kept short on purpose: observed 503 spikes lasted minutes, so a long backoff
// just stalls the user before failing anyway. This only rescues brief blips.
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateContent(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: Content[];
  functionDeclarations: FunctionDeclaration[];
}): Promise<Part[]> {
  const { apiKey, model, systemInstruction, contents, functionDeclarations } = params;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    tools: [{ functionDeclarations }],
  });

  let lastError: GeminiError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header auth rather than `?key=` so the user's API key never lands
          // in a URL (and therefore never in request logs).
          "x-goog-api-key": apiKey,
        },
        body,
      });
    } catch (cause) {
      // Network-level failure: also worth retrying.
      lastError = new GeminiError(`Tidak bisa menghubungi Gemini: ${String(cause)}`);
      continue;
    }

    if (res.ok) {
      const parsed = (await res.json()) as GenerateContentResponse;
      return parsed.candidates?.[0]?.content?.parts ?? [];
    }

    const detail = await res.text().catch(() => "");
    lastError = new GeminiError("Gemini menolak permintaan", res.status, detail);

    // 4xx other than 429 means the request itself is wrong (bad key, bad
    // model, malformed body) — retrying would just repeat the same failure.
    if (!RETRYABLE_STATUSES.has(res.status)) break;
    console.warn(`Gemini ${res.status}, percobaan ${attempt + 1}/${MAX_ATTEMPTS}`);
  }

  throw lastError ?? new GeminiError("Gemini gagal tanpa detail");
}

interface ListModelsResponse {
  models?: unknown[];
}

/**
 * Fetches the raw model list the given API key can reach. No retry: this is
 * not a hot path, and its failures (bad key = 400/403) are not transient, so
 * retrying would only stall the user before failing anyway. Returns the raw
 * entries; filtering/curation lives in models.ts so it stays testable.
 */
export async function listModels(apiKey: string): Promise<unknown[]> {
  let res: Response;
  try {
    res = await fetch(API_BASE, {
      method: "GET",
      // Header auth, same as generateContent — never `?key=` in a URL.
      headers: { "x-goog-api-key": apiKey },
    });
  } catch (cause) {
    throw new GeminiError(`Tidak bisa menghubungi Gemini: ${String(cause)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GeminiError("Gemini menolak permintaan", res.status, detail);
  }

  const parsed = (await res.json()) as ListModelsResponse;
  return parsed.models ?? [];
}
