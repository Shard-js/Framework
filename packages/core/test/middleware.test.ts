import { describe, it, expect } from "vitest";
import { composeMiddlewares } from "../src/middleware/runner.js";
import { createBot } from "../src/bot/createBot.js";
import type { ShardConfig } from "../src/types/index.js";

describe("Middleware Execution & Fail-Closed (Issues #8 & #9)", () => {
  it("executes middleware in onion fashion and handles next()", async () => {
    const order: number[] = [];

    const mw1 = async (ctx: any, next: () => Promise<void>) => {
      order.push(1);
      await next();
      order.push(4);
    };

    const mw2 = async (ctx: any, next: () => Promise<void>) => {
      order.push(2);
      await next();
      order.push(3);
    };

    await composeMiddlewares([mw1, mw2], {}, async () => {
      order.push(99);
    });

    expect(order).toEqual([1, 2, 99, 3, 4]);
  });

  it("stops pipeline when middleware does not call next() (Fail Closed / Issue #9)", async () => {
    let finalHandlerCalled = false;

    const blockingMw = async (ctx: any, next: () => Promise<void>) => {
      ctx.blocked = true;
    };

    const ctx: any = {};
    await composeMiddlewares([blockingMw], ctx, async () => {
      finalHandlerCalled = true;
    });

    expect(ctx.blocked).toBe(true);
    expect(finalHandlerCalled).toBe(false);
  });

  it("throws on startup if a command references an unresolved middleware (Issue #8)", async () => {
    const config: ShardConfig = {};
    const bot = createBot(config);

    bot.router.loadCommands = async () => {
      bot.router.commands.set("test-ban", {
        name: "test-ban",
        description: "Test ban",
        middleware: ["nonExistentAuthMiddleware"],
        run: () => {},
      });
    };

    await expect(bot.start()).rejects.toThrowError(
      /unresolved middleware "nonExistentAuthMiddleware"/
    );
  });
});
