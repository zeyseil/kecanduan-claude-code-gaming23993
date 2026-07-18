import { describe, expect, it } from "vitest";
import app from "../index";

describe("/agent/process", () => {
  it("rejects missing teks_input", async () => {
    const res = await app.request("/agent/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_api_key: "dummy" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing google_api_key", async () => {
    const res = await app.request("/agent/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teks_input: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns a not_implemented stub for a valid body", async () => {
    const res = await app.request("/agent/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teks_input: "test", google_api_key: "dummy" }),
    });
    expect(res.status).toBe(501);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("not_implemented");
  });
});
