/**
 * Rate Limiter for Discord API (v10)
 * Handles route buckets, global rate limits, and 429 Retry-After.
 * https://discord.com/developers/docs/topics/rate-limits
 */

interface BucketQueueItem<T = any> {
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

interface BucketState {
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in ms
  queue: BucketQueueItem[];
  processing: boolean;
}

export class RateLimiter {
  private buckets = new Map<string, BucketState>();
  private globalResetTime = 0;
  private routeToBucket = new Map<string, string>();

  /**
   * Normalizes an endpoint path to a route key for rate limiting.
   * Preserves top-level resources and major parameters (channelId, guildId, webhookId).
   */
  public getRouteKey(method: string, endpoint: string): string {
    // Strip query parameters
    const [path] = endpoint.split("?");

    // Replace minor IDs with generic tokens, keep major IDs (channels, guilds, webhooks)
    const normalized = path
      .replace(/\/channels\/(\d+)\/messages\/(\d+)/g, "/channels/$1/messages/:id")
      .replace(/\/guilds\/(\d+)\/members\/(\d+)/g, "/guilds/$1/members/:id")
      .replace(/\/webhooks\/(\d+)\/([^/]+)/g, "/webhooks/$1/:token");

    return `${method.toUpperCase()}:${normalized}`;
  }

  /**
   * Enqueues an API request through the bucket rate limiter.
   */
  public async execute<T>(
    routeKey: string,
    requestFn: () => Promise<{ response: Response; data: T }>
  ): Promise<T> {
    const bucketId = this.routeToBucket.get(routeKey) || routeKey;

    let bucket = this.buckets.get(bucketId);
    if (!bucket) {
      bucket = {
        limit: Infinity,
        remaining: 1,
        resetTime: 0,
        queue: [],
        processing: false,
      };
      this.buckets.set(bucketId, bucket);
    }

    return new Promise<T>((resolve, reject) => {
      bucket!.queue.push({
        execute: async () => {
          const result = await requestFn();
          return result.data;
        },
        resolve,
        reject,
      });

      this.processQueue(bucketId);
    });
  }

  private async processQueue(bucketId: string): Promise<void> {
    const bucket = this.buckets.get(bucketId);
    if (!bucket || bucket.processing || bucket.queue.length === 0) return;

    bucket.processing = true;

    while (bucket.queue.length > 0) {
      const now = Date.now();

      // Check global rate limit
      if (this.globalResetTime > now) {
        const waitMs = this.globalResetTime - now;
        await this.sleep(waitMs);
        continue;
      }

      // Check bucket rate limit
      if (bucket.remaining <= 0 && bucket.resetTime > now) {
        const waitMs = bucket.resetTime - now;
        await this.sleep(waitMs);
        continue;
      }

      const item = bucket.queue.shift();
      if (!item) break;

      try {
        const result = await item.execute();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }

    bucket.processing = false;
  }

  /**
   * Updates bucket state from Discord HTTP response headers.
   */
  public updateHeaders(
    routeKey: string,
    headers: Headers,
    status: number,
    retryAfterMs?: number
  ): void {
    const bucketHeader = headers.get("x-ratelimit-bucket");
    const limitHeader = headers.get("x-ratelimit-limit");
    const remainingHeader = headers.get("x-ratelimit-remaining");
    const resetAfterHeader = headers.get("x-ratelimit-reset-after");
    const isGlobal = headers.get("x-ratelimit-global") === "true";

    if (bucketHeader) {
      this.routeToBucket.set(routeKey, bucketHeader);
    }

    const bucketId = bucketHeader || this.routeToBucket.get(routeKey) || routeKey;
    let bucket = this.buckets.get(bucketId);
    if (!bucket) {
      bucket = {
        limit: Infinity,
        remaining: 1,
        resetTime: 0,
        queue: [],
        processing: false,
      };
      this.buckets.set(bucketId, bucket);
    }

    if (limitHeader) bucket.limit = parseInt(limitHeader, 10);
    if (remainingHeader) bucket.remaining = parseInt(remainingHeader, 10);
    if (resetAfterHeader) {
      const resetAfterSec = parseFloat(resetAfterHeader);
      bucket.resetTime = Date.now() + Math.ceil(resetAfterSec * 1000);
    }

    // Handle 429 Rate Limit
    if (status === 429 && retryAfterMs) {
      if (isGlobal) {
        this.globalResetTime = Date.now() + retryAfterMs;
      } else {
        bucket.remaining = 0;
        bucket.resetTime = Date.now() + retryAfterMs;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
