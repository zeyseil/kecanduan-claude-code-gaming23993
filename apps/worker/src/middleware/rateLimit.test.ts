import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env";
import { rateLimit } from "./rateLimit";

function buildApp() {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "alice");
    await next();
  });
  app.use("*", rateLimit);
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

function envWithLimiterResponse(status: number) {
  return {
    USER_RATE_LIMITER: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: async () => new Response(status === 200 ? "ok" : "rate limited", { status }) }),
    },
  } as unknown as Env;
}

describe("rateLimit", () => {
  it("allows the request through when the limiter allows it", async () => {
    const app = buildApp();
    const res = await app.request("/", {}, envWithLimiterResponse(200));
    expect(res.status).toBe(200);
  });

  it("returns 429 when the limiter rejects the request", async () => {
    const app = buildApp();
    const res = await app.request("/", {}, envWithLimiterResponse(429));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Terlalu banyak request, coba lagi sebentar." });
  });
});
