import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "./RateLimiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to capacity requests immediately", async () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      const res = await limiter.fetch();
      expect(res.status).toBe(200);
    }
  });

  it("queues the 6th request until a token refills", async () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      await limiter.fetch();
    }

    let resolved = false;
    const pending = limiter.fetch().then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(950);
    await pending;
    expect(resolved).toBe(true);
  });
});
