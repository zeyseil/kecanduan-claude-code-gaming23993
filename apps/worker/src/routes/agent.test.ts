import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../env";
import app from "../index";

const testEnv: Env = {
  ASTRA_DB_API_ENDPOINT: "https://fake.apps.astra.datastax.com",
  ASTRA_DB_APPLICATION_TOKEN: "fake-token",
  ASTRA_DB_COLLECTION: "comics",
  PROCESS_LOG_COLLECTION: "process_log",
  INTERNAL_TOOLS_SECRET: "test-secret",
  LANGFLOW_API_URL: "https://fake-langflow/api/v1/run/fake-flow",
  LANGFLOW_API_KEY: "fake-langflow-key",
  RATE_LIMITER: {} as Env["RATE_LIMITER"],
};

function request(body: unknown) {
  return app.request(
    "/agent/process",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    testEnv,
  );
}

describe("/agent/process", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects missing teks_input", async () => {
    const res = await request({ google_api_key: "dummy" });
    expect(res.status).toBe(400);
  });

  it("rejects missing google_api_key", async () => {
    const res = await request({ teks_input: "test" });
    expect(res.status).toBe(400);
  });

  it("forwards teks_input and per-run tweaks to Langflow, returns its response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ outputs: [{ result: "ok" }] }), { status: 200 }),
    );

    const res = await request({ teks_input: "baru baca monster ch33", google_api_key: "gk-1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outputs: [{ result: "ok" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(testEnv.LANGFLOW_API_URL);
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "fake-langflow-key" });

    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.input_value).toBe("baru baca monster ch33");
    expect(sentBody.tweaks["Agent-UVDzm"]).toEqual({ api_key: "gk-1" });
    expect(sentBody.tweaks["CustomComponent-zI7yQ"]).toEqual({
      internal_secret: "test-secret",
      app_user_id: "demo-user",
    });
  });

  it("returns 502 when Langflow responds with an error status", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 500 }));

    const res = await request({ teks_input: "test", google_api_key: "dummy" });
    expect(res.status).toBe(502);
  });

  it("returns 502 when the Langflow request throws (network/timeout)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const res = await request({ teks_input: "test", google_api_key: "dummy" });
    expect(res.status).toBe(502);
  });
});
