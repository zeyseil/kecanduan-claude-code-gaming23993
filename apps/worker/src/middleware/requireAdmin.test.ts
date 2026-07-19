import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { Env } from "../env";
import type { Role } from "../lib/authValue";
import { requireAdmin } from "./requireAdmin";

function appWithRole(role: Role) {
  const app = new Hono<{ Bindings: Env; Variables: { userId: string; role: Role } }>();
  app.use("*", async (c, next) => {
    c.set("role", role);
    await next();
  });
  app.use("*", requireAdmin);
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("requireAdmin", () => {
  it("403 when role is not admin", async () => {
    const res = await appWithRole("user").request("/");
    expect(res.status).toBe(403);
  });

  it("passes through when role is admin", async () => {
    const res = await appWithRole("admin").request("/");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
