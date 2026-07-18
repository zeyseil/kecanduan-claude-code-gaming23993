// Token-bucket throttle for browser/agent-facing requests, one instance per
// user (idFromName(userId)) — protects the Worker/Astra DB from a single user
// sending requests too fast. Unlike RateLimiter (which queues/waits for
// outbound MangaDex calls), this REJECTS over-limit requests with 429 rather
// than queueing them, since queueing here would just delay abuse instead of
// stopping it.
export class UserRateLimiter {
  private tokens = UserRateLimiter.CAPACITY;
  private lastRefill = Date.now();

  private static readonly CAPACITY = 20;
  private static readonly REFILL_PER_SECOND = 10;

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      UserRateLimiter.CAPACITY,
      this.tokens + elapsedSeconds * UserRateLimiter.REFILL_PER_SECOND,
    );
    this.lastRefill = now;
  }

  async fetch(): Promise<Response> {
    this.refill();
    if (this.tokens < 1) {
      return new Response("rate limited", { status: 429 });
    }
    this.tokens -= 1;
    return new Response("ok", { status: 200 });
  }
}

/** Resolves to true if the request is allowed, false if the user is over their rate limit. */
export async function acquireUserSlot(
  namespace: DurableObjectNamespace,
  userId: string,
): Promise<boolean> {
  const id = namespace.idFromName(userId);
  const stub = namespace.get(id);
  const res = await stub.fetch("https://user-rate-limiter/acquire");
  return res.status === 200;
}
