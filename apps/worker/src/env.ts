export interface Env {
  ASTRA_DB_API_ENDPOINT: string;
  ASTRA_DB_APPLICATION_TOKEN: string;
  ASTRA_DB_COLLECTION: string;
  PROCESS_LOG_COLLECTION: string;
  INTERNAL_TOOLS_SECRET: string;
  LANGFLOW_API_URL: string;
  LANGFLOW_API_KEY: string;
  RATE_LIMITER: DurableObjectNamespace;
}
