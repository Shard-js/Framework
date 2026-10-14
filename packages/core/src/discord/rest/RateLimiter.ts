
interface BucketQueueItem<T = any> {
  execute: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

interface BucketState {
  limit: number;
  remaining: number;
  resetTime: number;
  queue: BucketQueueItem[];
  processing: boolean;
}

export class RateLimiter {
  private buckets = new Map<string, BucketState>();
  private globalResetTime = 0;
  private routeToBucket = new Map<string, string>();
  private activeSleepTimers = new Set<() => void>();

  public getRouteKey(method: string, endpoint: string): string {
    const [path] = endpoint.split("?");

    const normalized = path
      .replace(/\/channels\/(\d+)\/messages\/(\d+)/g, "/channels/$1/messages/:id")
      .replace(/\/guilds\/(\d+)\/members\/(\d+)/g, "/guilds/$1/members/:id")
      .replace(/\/webhooks\/(\d+)\/([^/]+)/g, "/webhooks/$1/:token");

    return `${method.toUpperCase()}:${normalized}`;
  }

  public async execute<T>(
    routeKey: string,
    requestFn: () => Promise<{ response: Response; data: T }>
  ): Promise<T> {
    if (this.buckets.size > 500) {
      const now = Date.now();
      for (const [key, b] of this.buckets.entries()) {
        if (!b.processing && b.queue.length === 0 && now > b.resetTime) {
          this.buckets.delete(key);
        }
      }
    }

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

      if (this.globalResetTime > now) {
        const waitMs = this.globalResetTime - now;
        try {
          await this.sleep(waitMs);
        } catch {
          break;
        }
        continue;
      }

      if (bucket.remaining <= 0 && bucket.resetTime > now) {
        const waitMs = bucket.resetTime - now;
        try {
          await this.sleep(waitMs);
        } catch {
          break;
        }
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

    if (status === 429 && retryAfterMs) {
      if (isGlobal) {
        this.globalResetTime = Date.now() + retryAfterMs;
      } else {
        bucket.remaining = 0;
        bucket.resetTime = Date.now() + retryAfterMs;
      }
    }
  }

  public clear(): void {
    for (const cancel of this.activeSleepTimers) {
      cancel();
    }
    this.activeSleepTimers.clear();

    for (const bucket of this.buckets.values()) {
      for (const item of bucket.queue) {
        item.reject(new Error("RateLimiter cleared"));
      }
      bucket.queue = [];
      bucket.processing = false;
    }
    this.buckets.clear();
    this.routeToBucket.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.activeSleepTimers.delete(cancel);
        resolve();
      }, ms);
      const cancel = () => {
        clearTimeout(timer);
        this.activeSleepTimers.delete(cancel);
        reject(new Error("RateLimiter cleared"));
      };
      this.activeSleepTimers.add(cancel);
    });
  }
}
