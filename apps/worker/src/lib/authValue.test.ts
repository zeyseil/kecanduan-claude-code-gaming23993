import { describe, expect, it } from "vitest";
import { parseAuthValue } from "./authValue";

describe("parseAuthValue", () => {
  it("parses new JSON admin format", () => {
    expect(parseAuthValue('{"user_id":"owner","role":"admin"}')).toEqual({
      userId: "owner",
      role: "admin",
    });
  });

  it("parses new JSON user format", () => {
    expect(parseAuthValue('{"user_id":"friend","role":"user"}')).toEqual({
      userId: "friend",
      role: "user",
    });
  });

  it("defaults role to user when JSON omits it", () => {
    expect(parseAuthValue('{"user_id":"x"}')).toEqual({ userId: "x", role: "user" });
  });

  it("defaults role to user for an unrecognized role value", () => {
    expect(parseAuthValue('{"user_id":"x","role":"superuser"}')).toEqual({
      userId: "x",
      role: "user",
    });
  });

  it("treats a legacy bare string as user_id (backward-compat)", () => {
    expect(parseAuthValue("sigma-god")).toEqual({ userId: "sigma-god", role: "user" });
  });

  it("treats malformed JSON as a bare user_id", () => {
    expect(parseAuthValue("{oops")).toEqual({ userId: "{oops", role: "user" });
  });

  it("treats valid JSON that isn't our object shape as a bare user_id", () => {
    // A bare JSON string / number is valid JSON but not {user_id}.
    expect(parseAuthValue("42")).toEqual({ userId: "42", role: "user" });
  });
});
