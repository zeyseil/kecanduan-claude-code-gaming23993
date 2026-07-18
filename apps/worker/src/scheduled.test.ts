import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import worker from "./index";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
    ASTRA_DB_APPLICATION_TOKEN: "fake-token",
    ASTRA_DB_COLLECTION: "comics",
    PROCESS_LOG_COLLECTION: "process_log",
    INTERNAL_TOOLS_SECRET: "test-secret",
    LANGFLOW_API_URL: "https://fake-langflow/api/v1/run/fake-flow",
    LANGFLOW_API_KEY: "fake-langflow-key",
    RATE_LIMITER: {} as Env["RATE_LIMITER"],
    USER_RATE_LIMITER: {} as Env["USER_RATE_LIMITER"],
    AUTH_TOKENS: {} as Env["AUTH_TOKENS"],
    ...overrides,
  };
}

const event = {} as ScheduledController;

describe("scheduled keep-alive", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pings LANGFLOW_HEALTH_URL when set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await worker.scheduled(event, makeEnv({ LANGFLOW_HEALTH_URL: "https://space.hf.space/health" }));

    expect(fetchMock).toHaveBeenCalledWith("https://space.hf.space/health", { method: "GET" });
  });

  it("skips (no fetch) when LANGFLOW_HEALTH_URL is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await worker.scheduled(event, makeEnv());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when the ping fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      worker.scheduled(event, makeEnv({ LANGFLOW_HEALTH_URL: "https://space.hf.space/health" })),
    ).resolves.toBeUndefined();
  });
});
