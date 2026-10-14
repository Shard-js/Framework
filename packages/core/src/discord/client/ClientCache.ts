export interface CacheLimits {
  maxSize?: number;
  sweepIntervalMs?: number;
}

export class ClientCache<K, V> implements Map<K, V> {
  private map: Map<K, V> = new Map();
  private maxSize: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(options: CacheLimits = {}) {
    this.maxSize = options.maxSize ?? 1000;

    if (options.sweepIntervalMs && options.sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => {
        this.sweep();
      }, options.sweepIntervalMs);
      this.sweepTimer.unref?.();
    }
  }

  public get size(): number {
    return this.map.size;
  }

  public get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  public set(key: K, value: V): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }

    this.map.set(key, value);
    return this;
  }

  public has(key: K): boolean {
    return this.map.has(key);
  }

  public delete(key: K): boolean {
    return this.map.delete(key);
  }

  public clear(): void {
    this.map.clear();
  }

  public sweep(predicate?: (value: V, key: K) => boolean): number {
    let swept = 0;
    if (predicate) {
      for (const [key, val] of this.map.entries()) {
        if (predicate(val, key)) {
          this.map.delete(key);
          swept++;
        }
      }
    } else {
      if (this.map.size > this.maxSize * 0.75) {
        const toRemove = Math.floor(this.map.size * 0.25);
        let count = 0;
        for (const key of this.map.keys()) {
          if (count++ >= toRemove) break;
          this.map.delete(key);
          swept++;
        }
      }
    }
    return swept;
  }

  public destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.map.clear();
  }

  public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this.map.forEach(callbackfn, thisArg);
  }

  public entries(): MapIterator<[K, V]> {
    return this.map.entries();
  }

  public keys(): MapIterator<K> {
    return this.map.keys();
  }

  public values(): MapIterator<V> {
    return this.map.values();
  }

  public [Symbol.iterator](): MapIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }

  public get [Symbol.toStringTag](): string {
    return "ClientCache";
  }
}
