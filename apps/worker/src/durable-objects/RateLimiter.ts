// Token-bucket throttle for outbound metadata-source calls. One DO instance
// per source (fixed idFromName: "mangadex", "anilist") serializes acquisition
// across all isolates. Instances are configured via query params on the first
// acquire — the class stays generic, the per-source budget lives in the
// acquire helpers below.
export class RateLimiter {
  private capacity = RateLimiter.DEFAULT_CAPACITY;
  private refillPerSecond = RateLimiter.DEFAULT_REFILL_PER_SECOND;
  private tokens = RateLimiter.DEFAULT_CAPACITY;
  private lastRefill = Date.now();
  private configured = false;

  private static readonly DEFAULT_CAPACITY = 5;
  private static readonly DEFAULT_REFILL_PER_SECOND = 5;

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }

  async fetch(request: Request): Promise<Response> {
    // Config is in-memory per instance (this DO never uses storage) — applied
    // once so mid-flight requests don't shrink an already-filled bucket.
    if (!this.configured) {
      const url = new URL(request.url);
      const capacity = Number(url.searchParams.get("capacity"));
      const refill = Number(url.searchParams.get("refill"));
      if (Number.isFinite(capacity) && capacity > 0) {
        this.capacity = capacity;
        this.tokens = Math.min(this.tokens, capacity);
      }
      if (Number.isFinite(refill) && refill > 0) {
        this.refillPerSecond = refill;
      }
      this.configured = true;
    }

    this.refill();
    while (this.tokens < 1) {
      const waitMs = Math.max(10, Math.ceil(((1 - this.tokens) / this.refillPerSecond) * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }
    this.tokens -= 1;
    return new Response("ok");
  }
}

async function acquireSlot(
  namespace: DurableObjectNamespace,
  name: string,
  capacity: number,
  refill: number,
): Promise<void> {
  const id = namespace.idFromName(name);
  const stub = namespace.get(id);
  await stub.fetch(`https://rate-limiter/acquire?capacity=${capacity}&refill=${refill}`);
}

/** Blocks until a MangaDex request slot is available (<=5 req/s per TOOL_CONTRACTS.md). */
export async function acquireMangaDexSlot(namespace: DurableObjectNamespace): Promise<void> {
  await acquireSlot(namespace, "mangadex", 5, 5);
}

/** Blocks until an AniList request slot is available. AniList allows 90 req/min;
 * ~1 req/s sustained (burst 3) keeps us comfortably under it. */
export async function acquireAniListSlot(namespace: DurableObjectNamespace): Promise<void> {
  await acquireSlot(namespace, "anilist", 3, 1);
}

/** Comix API — user self-hosted, so a moderate budget is fine (same as MangaDex). */
export async function acquireComixSlot(namespace: DurableObjectNamespace): Promise<void> {
  await acquireSlot(namespace, "comix", 5, 5);
}

/** Komiku — hosted on a third-party free Vercel instance; keep it gentle. */
export async function acquireKomikuSlot(namespace: DurableObjectNamespace): Promise<void> {
  await acquireSlot(namespace, "komiku", 2, 1);
}
