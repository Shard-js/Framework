import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileRouter } from "../src/router/fileRouter.js";
import { createBot } from "../src/bot/createBot.js";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import { InteractionType } from "../src/discord/types/interactions.js";

describe("P2.12: Folder-based directory middleware (_middleware.ts)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shard-dirmw-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads directory middlewares and resolves cascade order correctly", async () => {
    const srcDir = path.join(tmpDir, "src", "commands");
    fs.mkdirSync(path.join(srcDir, "admin", "tools"), { recursive: true });

    // Root commands/_middleware.ts
    fs.writeFileSync(
      path.join(srcDir, "_middleware.ts"),
      `export default {
        name: "root-dir-mw",
        run: async (ctx, next) => {
          ctx.trace = [...(ctx.trace || []), "root-dir"];
          await next();
        }
      };`
    );

    // admin/_middleware.ts
    fs.writeFileSync(
      path.join(srcDir, "admin", "_middleware.ts"),
      `export default {
        name: "admin-dir-mw",
        run: async (ctx, next) => {
          ctx.trace = [...(ctx.trace || []), "admin-dir"];
          await next();
        }
      };`
    );

    const router = new FileRouter(tmpDir);
    await router.loadDirectoryMiddlewares();

    expect(router.directoryMiddlewares.has("")).toBe(true);
    expect(router.directoryMiddlewares.has("admin")).toBe(true);

    const pingFile = path.join(srcDir, "ping.ts");
    const pingMws = router.getDirectoryMiddlewaresForFile(pingFile);
    expect(pingMws).toHaveLength(1);
    expect(pingMws[0].name).toBe("root-dir-mw");

    const adminStatsFile = path.join(srcDir, "admin", "stats.ts");
    const adminMws = router.getDirectoryMiddlewaresForFile(adminStatsFile);
    expect(adminMws).toHaveLength(2);
    expect(adminMws[0].name).toBe("root-dir-mw");
    expect(adminMws[1].name).toBe("admin-dir-mw");

    const deepFile = path.join(srcDir, "admin", "tools", "deep.ts");
    const deepMws = router.getDirectoryMiddlewaresForFile(deepFile);
    expect(deepMws).toHaveLength(2);
    expect(deepMws[0].name).toBe("root-dir-mw");
    expect(deepMws[1].name).toBe("admin-dir-mw");
  });

  it("executes in exact order: Global -> Folder -> Command, and does not leak outside folder", async () => {
    const srcDir = path.join(tmpDir, "src", "commands");
    fs.mkdirSync(path.join(srcDir, "admin"), { recursive: true });

    const executionLog: string[] = [];

    const router = new FileRouter(tmpDir);

    // Global middleware (unnamed)
    router.middlewares.set("global-trace", {
      run: async (ctx, next) => {
        executionLog.push("global");
        await next();
      },
    });

    // Directory middleware for "admin"
    router.directoryMiddlewares.set("admin", [
      {
        name: "admin-mw",
        run: async (ctx, next) => {
          executionLog.push("folder:admin");
          await next();
        },
      },
    ]);

    // Command-specific middleware
    router.middlewares.set("cmd-auth", {
      name: "cmd-auth",
      run: async (ctx, next) => {
        executionLog.push("cmd:auth");
        await next();
      },
    });

    // Command inside admin/
    router.commands.set("ban", {
      name: "ban",
      description: "Ban user",
      filePath: path.join(srcDir, "admin", "ban.ts"),
      middleware: ["cmd-auth"],
      run: async () => {
        executionLog.push("run:ban");
      },
    });

    // Command outside admin/
    router.commands.set("ping", {
      name: "ping",
      description: "Ping command",
      filePath: path.join(srcDir, "ping.ts"),
      run: async () => {
        executionLog.push("run:ping");
      },
    });

    const bot = createBot(
      {
        token: "dummy",
        intents: [],
      },
      tmpDir
    );
    // Replace bot router with configured router
    Object.assign(bot.router, router);

    const mockRest = {
      post: vi.fn().mockResolvedValue({}),
    } as any;

    // 1. Execute admin command: /ban
    executionLog.length = 0;
    const banInteraction = new CommandInteraction(
      {
        id: "int-1",
        application_id: "app-1",
        token: "tok-1",
        type: InteractionType.ApplicationCommand,
        data: { name: "ban", type: 1 },
        user: { id: "u1", username: "user", discriminator: "0" },
      } as any,
      mockRest
    );

    await (bot.client as any).emit("interactionCreate", banInteraction);

    expect(executionLog).toEqual(["global", "folder:admin", "cmd:auth", "run:ban"]);

    // 2. Execute non-admin command: /ping
    executionLog.length = 0;
    const pingInteraction = new CommandInteraction(
      {
        id: "int-2",
        application_id: "app-1",
        token: "tok-2",
        type: InteractionType.ApplicationCommand,
        data: { name: "ping", type: 1 },
        user: { id: "u1", username: "user", discriminator: "0" },
      } as any,
      mockRest
    );

    await (bot.client as any).emit("interactionCreate", pingInteraction);

    // folder:admin must NOT be in the log!
    expect(executionLog).toEqual(["global", "run:ping"]);
  });
});
