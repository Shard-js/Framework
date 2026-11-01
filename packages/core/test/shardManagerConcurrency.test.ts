import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShardManager } from "../src/discord/gateway/ShardManager.js";
import { EventEmitter } from "node:events";

class MockWebSocket extends EventEmitter {
  public send() {}
  public close() {}
  public terminate() {}
}

describe("ShardManager Concurrency & Spawning Rate Limit (P1 Issue #5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("staggers shard spawning by 5000ms when max_concurrency is 1", async () => {
    const connectedShards: number[] = [];

    const mockWsFactory = () => {
      return new MockWebSocket() as any;
    };

    const mockRestClient = {
      get: vi.fn().mockResolvedValue({
        url: "wss://gateway.discord.gg",
        shards: 3,
        session_start_limit: {
          max_concurrency: 1,
        },
      }),
    };

    const manager = new ShardManager({
      token: "test-token",
      intents: 1,
      totalShards: 3,
      restClient: mockRestClient as any,
      wsFactory: mockWsFactory,
    });

    // Listen to shard creation
    manager.on("shardReady", (id) => connectedShards.push(id));

    const connectPromise = manager.connect();

    // Flush immediate microtasks so the first shard connects
    await vi.advanceTimersByTimeAsync(0);

    expect(manager.shards.has(0)).toBe(true);
    expect(manager.shards.has(1)).toBe(false);
    expect(manager.shards.has(2)).toBe(false);

    // Advance 5000ms
    await vi.advanceTimersByTimeAsync(5000);
    expect(manager.shards.has(1)).toBe(true);
    expect(manager.shards.has(2)).toBe(false);

    // Advance another 5000ms
    await vi.advanceTimersByTimeAsync(5000);
    expect(manager.shards.has(2)).toBe(true);

    await connectPromise;
    manager.destroy();
  });

  it("spawns shards in parallel across different concurrency buckets", async () => {
    const mockWsFactory = () => new MockWebSocket() as any;

    const mockRestClient = {
      get: vi.fn().mockResolvedValue({
        url: "wss://gateway.discord.gg",
        shards: 4,
        session_start_limit: {
          max_concurrency: 2,
        },
      }),
    };

    const manager = new ShardManager({
      token: "test-token",
      intents: 1,
      totalShards: 4,
      restClient: mockRestClient as any,
      wsFactory: mockWsFactory,
    });

    const connectPromise = manager.connect();
    await vi.advanceTimersByTimeAsync(0);

    // Shards 0 (0%2=0) and 1 (1%2=1) belong to different buckets and start immediately
    expect(manager.shards.has(0)).toBe(true);
    expect(manager.shards.has(1)).toBe(true);
    expect(manager.shards.has(2)).toBe(false);
    expect(manager.shards.has(3)).toBe(false);

    // After 5000ms, shards 2 (2%2=0) and 3 (3%2=1) start
    await vi.advanceTimersByTimeAsync(5000);
    expect(manager.shards.has(2)).toBe(true);
    expect(manager.shards.has(3)).toBe(true);

    await connectPromise;
    manager.destroy();
  });
});
