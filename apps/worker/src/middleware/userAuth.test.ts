import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env";
import { userAuth } from "./userAuth";

function buildApp() {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
  app.use("*", userAuth);
  app.get("/", (c) => c.json({ userId: c.get("userId") }));
  return app;
}

const fakeTokens = new Map([["valid-token", "alice"]]);
const testEnv = {
  AUTH_TOKENS: { get: async (key: string) => fakeTokens.get(key) ?? null },
} as unknown as Env;

describe("userAuth", () => {
  it("rejects a missing Authorization header", async () => {
    const app = buildApp();
    const res = await app.request("/", {}, testEnv);
    expect(res.status).toBe(401);
  });

  it("rejects an Authorization header without Bearer prefix", async () => {
    const app = buildApp();
    const res = await app.request("/", { headers: { Authorization: "valid-token" } }, testEnv);
    expect(res.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    const app = buildApp();
    const res = await app.request(
      "/",
      { headers: { Authorization: "Bearer unknown-token" } },
      testEnv,
    );
    expect(res.status).toBe(401);
  });

  it("allows through and exposes userId for a known token", async () => {
    const app = buildApp();
    const res = await app.request(
      "/",
      { headers: { Authorization: "Bearer valid-token" } },
      testEnv,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "alice" });
  });
});
