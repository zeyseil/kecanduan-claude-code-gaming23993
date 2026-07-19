export interface Env {
  ASTRA_DB_API_ENDPOINT: string;
  ASTRA_DB_APPLICATION_TOKEN: string;
  ASTRA_DB_COLLECTION: string;
  PROCESS_LOG_COLLECTION: string;
  /** Optional override for the Gemini model used by the agent — see
   * DEFAULT_GEMINI_MODEL in agent/geminiClient.ts. */
  GEMINI_MODEL?: string;
  /** Comma-separated list of browser origins allowed to call this Worker.
   * Empty/unset falls back to the local vite dev server. */
  ALLOWED_ORIGINS?: string;
  RATE_LIMITER: DurableObjectNamespace;
  USER_RATE_LIMITER: DurableObjectNamespace;
  AUTH_TOKENS: KVNamespace;
}
