export interface Env {
  ASTRA_DB_API_ENDPOINT: string;
  ASTRA_DB_APPLICATION_TOKEN: string;
  ASTRA_DB_COLLECTION: string;
  PROCESS_LOG_COLLECTION: string;
  INTERNAL_TOOLS_SECRET: string;
  LANGFLOW_API_URL: string;
  LANGFLOW_API_KEY: string;
  // Health endpoint of the Langflow instance, pinged by the cron trigger to
  // keep a Hugging Face Space from going to sleep. Optional — the scheduled
  // handler no-ops when unset (e.g. when Langflow runs locally).
  LANGFLOW_HEALTH_URL?: string;
  RATE_LIMITER: DurableObjectNamespace;
  USER_RATE_LIMITER: DurableObjectNamespace;
  AUTH_TOKENS: KVNamespace;
}
