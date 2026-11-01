import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createLogger,
  MetricsCollector,
  createBot,
  createMockInteraction,
  Client,
  defineCommand,
} from "../src/index.js";
import { RestClient } from "../src/discord/rest/RestClient.js";

describe("Operational Health, Metrics, Logging, Cooldowns & Error Handling", () => {
  describe("Structured Logging", () => {
    it("logs JSON format correctly with metadata and levels", () => {
      const logs: string[] = [];
      const logger = createLogger({
        level: "info",
        format: "json",
        destination: (_entry, formatted) => logs.push(formatted),
      });

      logger.debug("Should be filtered out");
      expect(logs.length).toBe(0);

      logger.info("Bot connected", { shardId: 0 });
      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Bot connected");
      expect(parsed.context.shardId).toBe(0);
      expect(parsed.timestamp).toBeDefined();

      const testError = new Error("Gateway failed");
      logger.error("Crash", testError, { critical: true });
      expect(logs.length).toBe(2);
      const parsedErr = JSON.parse(logs[1]);
      expect(parsedErr.level).toBe("error");
      expect(parsedErr.error.message).toBe("Gateway failed");
      expect(parsedErr.context.critical).toBe(true);
    });

    it("creates child loggers with inherited context", () => {
      const logs: any[] = [];
      const parent = createLogger({
        level: "debug",
        format: "json",
        defaultContext: { service: "core" },
        destination: (entry) => logs.push(entry),
      });

      const child = parent.child({ module: "command-router" });
      child.info("Dispatched command", { command: "ping" });

      expect(logs.length).toBe(1);
      expect(logs[0].context).toEqual({
        service: "core",
        module: "command-router",
        command: "ping",
      });
    });

    it("formats pretty logs with levels", () => {
      const formattedLogs: string[] = [];
      const logger = createLogger({
        level: "warn",
        format: "pretty",
        destination: (_entry, formatted) => formattedLogs.push(formatted),
      });

      logger.info("Should not log");
      logger.warn("Slow query detected", { durationMs: 120 });
      expect(formattedLogs.length).toBe(1);
      expect(formattedLogs[0]).toContain("[WARN]");
      expect(formattedLogs[0]).toContain("Slow query detected");
      expect(formattedLogs[0]).toContain("120");
    });
  });

  describe("Metrics Collector", () => {
    it("tracks gateway ping, rate limits, and command executions", () => {
      const mockWs = { ping: 42 };
      const metrics = new MetricsCollector(() => ({ ws: mockWs }));

      expect(metrics.gatewayPing).toBe(42);
      expect(metrics.rateLimitHits).toBe(0);
      expect(metrics.commandsExecuted).toBe(0);

      metrics.recordCommand("ping");
      metrics.recordCommand("ping");
      metrics.recordCommand("help");
      metrics.recordCommandError("help", new Error("Failed"));
      metrics.recordRateLimit("/guilds/123");

      expect(metrics.commandsExecuted).toBe(3);
      expect(metrics.commandErrors).toBe(1);
      expect(metrics.rateLimitHits).toBe(1);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.gatewayPing).toBe(42);
      expect(snapshot.rateLimitHits).toBe(1);
      expect(snapshot.commands.total).toBe(3);
      expect(snapshot.commands.errors).toBe(1);
      expect(snapshot.commands.byName.ping).toBe(2);
      expect(snapshot.commands.byName.help).toBe(1);
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });

    it("captures REST 429 rate limit events in RestClient", async () => {
      const rateLimitHits: any[] = [];
      const rest = new RestClient({
        onRateLimit: (info) => rateLimitHits.push(info),
        maxRetries: 0,
      });

      // Mock fetch returning 429
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ retry_after: 0.1, global: false }), {
          status: 429,
          headers: { "Content-Type": "application/json", "retry-after": "1" },
        })
      );

      try {
        await expect(rest.get("/test-endpoint")).rejects.toThrow();
        expect(rateLimitHits.length).toBe(1);
        expect(rateLimitHits[0].retryAfterMs).toBe(100);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("Command Cooldowns", () => {
    it("enforces command cooldown on repeated calls", async () => {
      let runCount = 0;
      const bot = createBot({
        token: "fake-token",
      });

      const pingCmd = defineCommand({
        name: "ping",
        description: "Ping command with cooldown",
        cooldown: 5, // 5 seconds cooldown
        run: async () => {
          runCount++;
        },
      });

      bot.router.commands.set("ping", pingCmd);

      const interaction1 = createMockInteraction({
        commandName: "ping",
        user: { id: "user-123" },
      });

      bot.client.emit("interactionCreate", interaction1);
      await new Promise((r) => setTimeout(r, 20));
      expect(runCount).toBe(1);

      // Second interaction from same user within cooldown
      const interaction2 = createMockInteraction({
        commandName: "ping",
        user: { id: "user-123" },
      });

      bot.client.emit("interactionCreate", interaction2);
      await new Promise((r) => setTimeout(r, 20));
      expect(runCount).toBe(1); // Not executed
      expect(interaction2.replies.length).toBe(1);
      expect(interaction2.replies[0].content).toContain("⏳ Please wait");

      // Interaction from different user succeeds
      const interaction3 = createMockInteraction({
        commandName: "ping",
        user: { id: "user-456" },
      });

      bot.client.emit("interactionCreate", interaction3);
      await new Promise((r) => setTimeout(r, 20));
      expect(runCount).toBe(2);
    });

    it("supports custom onCooldown handler", async () => {
      let customCooldownInvoked = false;
      const bot = createBot({
        token: "fake-token",
      });

      const burstCmd = defineCommand({
        name: "burst",
        cooldown: 10,
        onCooldown: async (ctx, remaining) => {
          customCooldownInvoked = true;
          await ctx.interaction.reply({
            content: `Too fast! ${remaining}s left`,
            ephemeral: true,
          });
        },
        run: async (ctx) => {
          await ctx.interaction.reply("OK");
        },
      });

      bot.router.commands.set("burst", burstCmd);

      const i1 = createMockInteraction({ commandName: "burst", user: { id: "u1" } });
      bot.client.emit("interactionCreate", i1);
      await new Promise((r) => setTimeout(r, 20));

      const i2 = createMockInteraction({ commandName: "burst", user: { id: "u1" } });
      bot.client.emit("interactionCreate", i2);
      await new Promise((r) => setTimeout(r, 20));

      expect(customCooldownInvoked).toBe(true);
      expect(i2.replies[0].content).toContain("Too fast!");
    });
  });

  describe("Central Command Error Handling", () => {
    it("calls onCommandError when command throws", async () => {
      let capturedError: Error | null = null;
      let capturedCmdName: string | null = null;

      const bot = createBot({
        token: "fake-token",
        onCommandError: async (err, ctx) => {
          capturedError = err;
          capturedCmdName = ctx.interaction.commandName;
          await ctx.interaction.reply({ content: "Handled by custom error handler" });
        },
      });

      const failingCmd = defineCommand({
        name: "fail",
        run: async () => {
          throw new Error("Database timeout");
        },
      });

      bot.router.commands.set("fail", failingCmd);

      const interaction = createMockInteraction({ commandName: "fail" });
      bot.client.emit("interactionCreate", interaction);
      await new Promise((r) => setTimeout(r, 20));

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toBe("Database timeout");
      expect(capturedCmdName).toBe("fail");
      expect(interaction.replies[0].content).toBe("Handled by custom error handler");
      expect(bot.client.metrics.commandErrors).toBe(1);
    });
  });

  describe("Health Check Endpoint", () => {
    it("serves /health endpoint with status, gateway and metrics", async () => {
      const bot = createBot({
        token: "fake-token",
        api: { port: 3889 },
        healthCheck: {
          path: "/health",
          customCheck: async () => ({ dbStatus: "connected" }),
        },
      });

      expect(bot.apiServer).toBeDefined();
      const match = bot.apiServer!.router.match("/health", "GET");
      expect(match).not.toBeNull();
      expect(match?.route.methods["GET"]).toBeDefined();

      const response = await match!.route.methods["GET"](new Request("http://localhost/health"), {} as any);
      const json = await response.json();

      expect(json.status).toBeDefined();
      expect(json.uptime).toBeGreaterThanOrEqual(0);
      expect(json.gateway).toBeDefined();
      expect(json.metrics).toBeDefined();
      expect(json.dbStatus).toBe("connected");
    });
  });
});
