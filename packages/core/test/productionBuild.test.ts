import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileRouter } from "../src/router/fileRouter.js";
import { createBot } from "../src/bot/createBot.js";
import { ApiRouter } from "@shardjs-framework/api";

describe("Production Build and Docker Compatibility (P0 Issue #1)", () => {
  let tempDir: string;
  let distDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shard-prod-test-"));
    distDir = path.join(tempDir, ".shard", "dist");
    fs.mkdirSync(path.join(distDir, "commands"), { recursive: true });
    fs.mkdirSync(path.join(distDir, "events"), { recursive: true });
    fs.mkdirSync(path.join(distDir, "app", "api", "health"), { recursive: true });

    // Note: tempDir intentionally DOES NOT have a "src" folder (matching the Docker runner stage)
    fs.writeFileSync(
      path.join(distDir, "commands", "ping.js"),
      `export default {
        name: "ping",
        description: "Replies with pong",
        run: async () => "pong"
      };`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(distDir, "events", "ready.js"),
      `export default {
        event: "ready",
        once: true,
        run: () => {}
      };`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(distDir, "app", "api", "health", "route.js"),
      `export const GET = async () => new Response(JSON.stringify({ ok: true }));`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(distDir, "shard.config.js"),
      `export default {
        token: "fake-token",
        api: { port: 3000 }
      };`,
      "utf-8"
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads commands, events and API routes in production without src/ folder", async () => {
    const apiRouter = new ApiRouter("/api");
    const router = new FileRouter(tempDir, apiRouter, {
      distDir,
      isProduction: true,
    });

    await router.loadAll();

    expect(router.commands.has("ping")).toBe(true);
    expect(router.events.has("ready")).toBe(true);
    expect(apiRouter.getRoutes().length).toBeGreaterThan(0);
  });

  it("createBot correctly passes distDir and isProduction to FileRouter", async () => {
    const bot = createBot(
      { token: "test-token", api: { port: 3000 } },
      tempDir,
      { distDir, isProduction: true }
    );

    await bot.router.loadAll();

    expect(bot.router.commands.has("ping")).toBe(true);
    expect(bot.router.events.has("ready")).toBe(true);
  });
});
