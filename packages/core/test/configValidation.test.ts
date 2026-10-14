import { describe, it, expect } from "vitest";
import {
  apiServerConfigSchema,
  shardConfigSchema,
  normalizeIntents,
} from "../src/config/loadConfig.js";
import { RateLimiter } from "../src/discord/rest/RateLimiter.js";
import { Shard, ShardStatus } from "../src/discord/gateway/Shard.js";
import { Client } from "../src/discord/client/Client.js";

describe("Backend Validation & Lifecycle Hardening", () => {
  describe("API and Shard Config Validation", () => {
    it("accepts valid API configuration", () => {
      const valid = apiServerConfigSchema.safeParse({
        port: 8080,
        host: "127.0.0.1",
        prefix: "/api/v1",
        maxBodySize: 2097152,
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid port numbers (negative, 0, or > 65535)", () => {
      const zero = apiServerConfigSchema.safeParse({ port: 0 });
      expect(zero.success).toBe(false);

      const tooHigh = apiServerConfigSchema.safeParse({ port: 70000 });
      expect(tooHigh.success).toBe(false);

      const floatPort = apiServerConfigSchema.safeParse({ port: 3000.5 });
      expect(floatPort.success).toBe(false);
    });

    it("rejects invalid prefix format not starting with slash", () => {
      const invalid = apiServerConfigSchema.safeParse({ prefix: "api/v1" });
      expect(invalid.success).toBe(false);
    });

    it("validates full shard configuration", () => {
      const valid = shardConfigSchema.safeParse({
        token: "test-token",
        intents: ["Guilds", "GuildMessages"],
        api: {
          port: 3000,
          prefix: "/api",
        },
      });
      expect(valid.success).toBe(true);
    });

    it("normalizes intents correctly", () => {
      const result = normalizeIntents(["Guilds", 1]);
      expect(result).toContain(1);
    });
  });

  describe("RateLimiter Lifecycle & Cleanup", () => {
    it("rejects pending requests when cleared and cleans up buckets", async () => {
      const limiter = new RateLimiter();
      limiter.updateHeaders("GET:/test", new Headers(), 429, 60_000);

      let rejectReason: any;
      const pendingPromise = limiter.execute("GET:/test", async () => {
        return { response: new Response(), data: "ok" };
      }).catch((err) => {
        rejectReason = err;
      });

      limiter.clear();
      await pendingPromise;

      expect(rejectReason).toBeDefined();
      expect(rejectReason.message).toBe("RateLimiter cleared");
    });
  });

  describe("Shard Lifecycle & Timer Guard", () => {
    it("Shard.destroy() sets status to Destroyed, removes listeners, and ignores reconnect", () => {
      const shard = new Shard({
        id: 0,
        totalShards: 1,
        token: "fake-token",
        intents: 1,
      });

      let errorEmitted = false;
      shard.on("error", () => {
        errorEmitted = true;
      });

      shard.destroy();
      expect(shard.status).toBe(ShardStatus.Destroyed);
      expect(shard.listenerCount("error")).toBe(0);

      expect(() => shard.connect()).toThrowError(/Cannot connect destroyed Shard 0/);
      expect(errorEmitted).toBe(false);
    });
  });

  describe("Client Lifecycle & Listener Cleanup", () => {
    it("Client.destroy() cleans up all listeners and child resources", async () => {
      const client = new Client({ token: "test" });

      let called = false;
      client.on("ready", () => {
        called = true;
      });

      await client.destroy();
      expect(client.listenerCount("ready")).toBe(0);
      expect(client.isReady()).toBe(false);
      expect(called).toBe(false);
    });
  });
});
