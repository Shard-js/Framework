import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { FileRouter } from "../src/router/fileRouter.js";
import { createBot } from "../src/bot/createBot.js";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import {
  InteractionType,
  ApplicationCommandOptionType,
} from "../src/discord/types/interactions.js";

describe("P2.11: Subcommands via folder structure", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shard-subcmd-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("aggregates folder files into subcommands and subcommand groups", async () => {
    const srcDir = path.join(tmpDir, "src", "commands");
    fs.mkdirSync(path.join(srcDir, "moderation"), { recursive: true });
    fs.mkdirSync(path.join(srcDir, "settings", "logs"), { recursive: true });

    // /moderation ban
    fs.writeFileSync(
      path.join(srcDir, "moderation", "ban.ts"),
      `export default {
        name: "ban",
        description: "Bans a member",
        options: [{ name: "user", description: "Target user", type: "User", required: true }],
        run: () => "banned",
      };`
    );

    // /moderation kick
    fs.writeFileSync(
      path.join(srcDir, "moderation", "kick.ts"),
      `export default {
        name: "kick",
        description: "Kicks a member",
        run: () => "kicked",
      };`
    );

    // /settings logs channel
    fs.writeFileSync(
      path.join(srcDir, "settings", "logs", "channel.ts"),
      `export default {
        name: "channel",
        description: "Sets log channel",
        run: () => "channel-set",
      };`
    );

    const router = new FileRouter(tmpDir);
    await router.loadCommands();

    expect(router.commands.has("moderation")).toBe(true);
    const modCmd = router.commands.get("moderation")!;
    expect(modCmd.name).toBe("moderation");
    expect(modCmd.subcommands).toBeDefined();
    expect(modCmd.subcommands?.has("ban")).toBe(true);
    expect(modCmd.subcommands?.has("kick")).toBe(true);

    expect(modCmd.options).toHaveLength(2);
    const [subBan, subKick] = modCmd.options!;
    expect(subBan.name).toBe("ban");
    expect(subBan.type).toBe("Subcommand");
    expect(subBan.options).toHaveLength(1);
    expect(subKick.name).toBe("kick");
    expect(subKick.type).toBe("Subcommand");

    expect(router.commands.has("settings")).toBe(true);
    const settingsCmd = router.commands.get("settings")!;
    expect(settingsCmd.subcommands).toBeDefined();
    expect(settingsCmd.subcommands?.has("logs:channel")).toBe(true);

    expect(settingsCmd.options).toHaveLength(1);
    const groupLogs = settingsCmd.options![0];
    expect(groupLogs.name).toBe("logs");
    expect(groupLogs.type).toBe("SubcommandGroup");
    expect(groupLogs.options).toHaveLength(1);
    expect(groupLogs.options![0].name).toBe("channel");
    expect(groupLogs.options![0].type).toBe("Subcommand");
  });

  it("dispatches interaction to the correct subcommand handler", async () => {
    const srcDir = path.join(tmpDir, "src", "commands");
    fs.mkdirSync(path.join(srcDir, "moderation"), { recursive: true });

    const banRun = vi.fn();
    const kickRun = vi.fn();

    // Directly test routing with pre-registered definitions in FileRouter
    const router = new FileRouter(tmpDir);
    const modCmd: any = {
      name: "moderation",
      description: "Moderation commands",
      subcommands: new Map([
        [
          "ban",
          {
            name: "ban",
            description: "Ban user",
            run: banRun,
          },
        ],
        [
          "kick",
          {
            name: "kick",
            description: "Kick user",
            run: kickRun,
          },
        ],
      ]),
    };
    const bot = createBot(
      {
        token: "dummy",
        intents: [],
      },
      tmpDir
    );
    bot.router.commands.set("moderation", modCmd);

    const mockRest = {
      post: vi.fn().mockResolvedValue({}),
    } as any;

    const banPayload: any = {
      id: "int-1",
      application_id: "app-1",
      token: "tok-1",
      type: InteractionType.ApplicationCommand,
      data: {
        name: "moderation",
        type: 1,
        options: [
          {
            name: "ban",
            type: ApplicationCommandOptionType.Subcommand,
            options: [{ name: "target", type: 6, value: "123" }],
          },
        ],
      },
      user: { id: "admin-1", username: "admin", discriminator: "0" },
    };

    const interaction = new CommandInteraction(banPayload, mockRest);
    await (bot.client as any).emit("interactionCreate", interaction);

    expect(banRun).toHaveBeenCalledTimes(1);
    expect(kickRun).not.toHaveBeenCalled();
    const callCtx = banRun.mock.calls[0][0];
    expect(callCtx.options.getSubcommand()).toBe("ban");
  });
});
