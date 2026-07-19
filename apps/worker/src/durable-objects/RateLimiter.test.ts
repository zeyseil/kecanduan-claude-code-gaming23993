import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "./RateLimiter";

const acquire = (limiter: RateLimiter, query = "") =>
  limiter.fetch(new Request(`https://rate-limiter/acquire${query}`));

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to capacity requests immediately (default 5)", async () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      const res = await acquire(limiter);
      expect(res.status).toBe(200);
    }
  });

  it("queues the 6th request until a token refills", async () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      await acquire(limiter);
    }

    let resolved = false;
    const pending = acquire(limiter).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(950);
    await pending;
    expect(resolved).toBe(true);
  });

  it("honours capacity/refill query params (AniList: capacity 3, refill 1/s)", async () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 3; i++) {
      await acquire(limiter, "?capacity=3&refill=1");
    }

    let resolved = false;
    const pending = acquire(limiter, "?capacity=3&refill=1").then(() => {
      resolved = true;
    });

    // Refill 1/s: 500ms is not enough for a new token…
    await vi.advanceTimersByTimeAsync(500);
    expect(resolved).toBe(false);

    // …a full second is.
    await vi.advanceTimersByTimeAsync(600);
    await pending;
    expect(resolved).toBe(true);
  });
});
