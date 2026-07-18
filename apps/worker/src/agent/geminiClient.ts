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

// Model name is configurable via env.GEMINI_MODEL. If Google renames or
// retires this one, override the env var — no code change needed.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateContent(params: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: Content[];
  functionDeclarations: FunctionDeclaration[];
}): Promise<Part[]> {
  const { apiKey, model, systemInstruction, contents, functionDeclarations } = params;

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
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        tools: [{ functionDeclarations }],
      }),
    });
  } catch (cause) {
    throw new GeminiError(`Tidak bisa menghubungi Gemini: ${String(cause)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GeminiError("Gemini menolak permintaan", res.status, detail);
  }

  const body = (await res.json()) as GenerateContentResponse;
  return body.candidates?.[0]?.content?.parts ?? [];
}
