import { describe, it, expect, vi } from "vitest";
import {
  requireGuild,
  requirePermissions,
  cooldown,
  rateLimit,
  logCommand,
  composeMiddlewares,
  PermissionFlagsBits,
  PermissionsBitField,
} from "../src/index.js";

describe("Built-in Middlewares", () => {
  it("requireGuild blocks DM interactions and passes in guilds", async () => {
    const mw = requireGuild();

    let nextCalled = false;
    let replyCalled = false;

    // Simulate DM interaction
    const dmCtx: any = {
      interaction: {
        inGuild: () => false,
        reply: async (opts: any) => {
          replyCalled = true;
        },
      },
    };

    await composeMiddlewares([mw.run], dmCtx, async () => {
      nextCalled = true;
    });

    expect(replyCalled).toBe(true);
    expect(nextCalled).toBe(false);

    // Simulate Guild interaction
    nextCalled = false;
    replyCalled = false;
    const guildCtx: any = {
      interaction: {
        inGuild: () => true,
        reply: async () => {},
      },
    };

    await composeMiddlewares([mw.run], guildCtx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(replyCalled).toBe(false);
  });

  it("requirePermissions blocks members lacking permission", async () => {
    const mw = requirePermissions(PermissionFlagsBits.BanMembers);

    let nextCalled = false;
    let replyPayload: any = null;

    // Member with only SendMessages
    const unauthorizedCtx: any = {
      interaction: {
        memberPermissions: new PermissionsBitField(PermissionFlagsBits.SendMessages),
        reply: async (payload: any) => {
          replyPayload = payload;
        },
      },
    };

    await composeMiddlewares([mw.run], unauthorizedCtx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(replyPayload.content).toContain("lack the required permissions");

    // Member with Administrator or BanMembers
    nextCalled = false;
    const authorizedCtx: any = {
      interaction: {
        memberPermissions: new PermissionsBitField(PermissionFlagsBits.BanMembers),
        reply: async () => {},
      },
    };

    await composeMiddlewares([mw.run], authorizedCtx, async () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it("cooldown enforces wait time between executions", async () => {
    const mw = cooldown(5); // 5 seconds
    let executed = 0;
    let cooldownReply = "";

    const userCtx: any = {
      interaction: {
        commandName: "daily",
        user: { id: "user-123" },
        reply: async (opts: any) => {
          cooldownReply = opts.content;
        },
      },
    };

    // First call: passes
    await composeMiddlewares([mw.run], userCtx, async () => {
      executed++;
    });
    expect(executed).toBe(1);

    // Immediate second call: blocked by cooldown
    await composeMiddlewares([mw.run], userCtx, async () => {
      executed++;
    });
    expect(executed).toBe(1);
    expect(cooldownReply).toContain("Please wait");
  });

  it("rateLimit enforces sliding window threshold", async () => {
    const mw = rateLimit({ max: 2, windowMs: 1000 });
    let count = 0;

    const ctx: any = {
      interaction: {
        commandName: "ping",
        user: { id: "user-abc" },
        reply: async () => {},
      },
    };

    // Call 1
    await composeMiddlewares([mw.run], ctx, async () => {
      count++;
    });
    // Call 2
    await composeMiddlewares([mw.run], ctx, async () => {
      count++;
    });
    // Call 3: blocked
    await composeMiddlewares([mw.run], ctx, async () => {
      count++;
    });

    expect(count).toBe(2);
  });

  it("logCommand logs duration and user upon completion", async () => {
    const mw = logCommand();
    let loggedMsg = "";

    const ctx: any = {
      interaction: {
        commandName: "stats",
        user: { username: "Alice" },
      },
      logger: {
        info: (msg: string) => {
          loggedMsg = msg;
        },
        error: () => {},
      },
    };

    await composeMiddlewares([mw.run], ctx, async () => {
      // mock work
    });

    expect(loggedMsg).toContain("/stats completed in");
    expect(loggedMsg).toContain("by Alice");
  });
});
