import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserRateLimiter } from "./UserRateLimiter";

describe("UserRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to capacity requests immediately", async () => {
    const limiter = new UserRateLimiter();
    for (let i = 0; i < 20; i++) {
      const res = await limiter.fetch();
      expect(res.status).toBe(200);
    }
  });

  it("rejects the request past capacity with 429, instead of queueing", async () => {
    const limiter = new UserRateLimiter();
    for (let i = 0; i < 20; i++) {
      await limiter.fetch();
    }

    const res = await limiter.fetch();
    expect(res.status).toBe(429);
  });

  it("recovers after tokens refill", async () => {
    const limiter = new UserRateLimiter();
    for (let i = 0; i < 20; i++) {
      await limiter.fetch();
    }
    expect((await limiter.fetch()).status).toBe(429);

    vi.advanceTimersByTime(1000);
    expect((await limiter.fetch()).status).toBe(200);
  });
});
