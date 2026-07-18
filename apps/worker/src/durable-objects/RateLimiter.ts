// Token-bucket throttle for outbound MangaDex calls (TOOL_CONTRACTS.md §2.4:
// <=5 req/s across the whole Worker, not per-user). A single global instance
// (fixed id "mangadex") serializes acquisition across all isolates.
export class RateLimiter {
  private tokens = RateLimiter.CAPACITY;
  private lastRefill = Date.now();

  private static readonly CAPACITY = 5;
  private static readonly REFILL_PER_SECOND = 5;

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      RateLimiter.CAPACITY,
      this.tokens + elapsedSeconds * RateLimiter.REFILL_PER_SECOND,
    );
    this.lastRefill = now;
  }

  async fetch(): Promise<Response> {
    this.refill();
    while (this.tokens < 1) {
      const waitMs = Math.max(
        10,
        Math.ceil(((1 - this.tokens) / RateLimiter.REFILL_PER_SECOND) * 1000),
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= 1;
    return new Response("ok");
  }
}

/** Blocks until a MangaDex request slot is available (queues briefly rather than failing). */
export async function acquireMangaDexSlot(namespace: DurableObjectNamespace): Promise<void> {
  const id = namespace.idFromName("mangadex");
  const stub = namespace.get(id);
  await stub.fetch("https://rate-limiter/acquire");
}
