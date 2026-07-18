import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env";
import { internalAuth } from "./internalAuth";

function buildApp() {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
  app.use("*", internalAuth);
  app.get("/", (c) => c.json({ userId: c.get("userId") }));
  return app;
}

const testEnv = { INTERNAL_TOOLS_SECRET: "correct-secret" } as Env;

describe("internalAuth", () => {
  it("rejects a missing/incorrect X-Internal-Secret", async () => {
    const app = buildApp();
    const res = await app.request(
      "/",
      { headers: { "X-User-Id": "demo-user" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("rejects a missing X-User-Id", async () => {
    const app = buildApp();
    const res = await app.request(
      "/",
      { headers: { "X-Internal-Secret": "correct-secret" } },
      testEnv,
    );
    expect(res.status).toBe(400);
  });

  it("allows through and exposes userId when both headers are valid", async () => {
    const app = buildApp();
    const res = await app.request(
      "/",
      { headers: { "X-Internal-Secret": "correct-secret", "X-User-Id": "demo-user" } },
      testEnv,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "demo-user" });
  });
});
