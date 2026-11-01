import { describe, it, expect, vi } from "vitest";
import {
  commandToDiscordJson,
  resolveCommandType,
} from "../src/deploy/deployCommands.js";
import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  InteractionType,
} from "../src/discord/types/interactions.js";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import { FileRouter } from "../src/router/fileRouter.js";
import type { CommandDefinition } from "../src/types/index.js";

describe("P2.10: Command deployment options & context menu commands", () => {
  it("serializes extended ChatInput options (min/max values, lengths, channel_types, localizations)", () => {
    const command: CommandDefinition = {
      name: "test-opts",
      description: "Testing options",
      nsfw: true,
      guildOnly: true,
      nameLocalizations: { de: "test-opt" },
      descriptionLocalizations: { de: "Testet Optionen" },
      options: [
        {
          name: "count",
          description: "Count value",
          type: "Integer",
          minValue: 1,
          maxValue: 100,
          nameLocalizations: { de: "anzahl" },
          descriptionLocalizations: { de: "Anzahlwert" },
        },
        {
          name: "query",
          description: "Query text",
          type: "String",
          minLength: 3,
          maxLength: 50,
        },
        {
          name: "channel",
          description: "Target channel",
          type: "Channel",
          channelTypes: [0, 2], // GUILD_TEXT, GUILD_VOICE
        },
      ],
      run: vi.fn(),
    };

    const json = commandToDiscordJson(command);

    expect(json.name).toBe("test-opts");
    expect(json.description).toBe("Testing options");
    expect(json.nsfw).toBe(true);
    expect(json.dm_permission).toBe(false);
    expect(json.name_localizations).toEqual({ de: "test-opt" });
    expect(json.description_localizations).toEqual({ de: "Testet Optionen" });

    expect(json.options).toHaveLength(3);
    const [optCount, optQuery, optChannel] = json.options;

    expect(optCount.type).toBe(ApplicationCommandOptionType.Integer);
    expect(optCount.min_value).toBe(1);
    expect(optCount.max_value).toBe(100);
    expect(optCount.name_localizations).toEqual({ de: "anzahl" });
    expect(optCount.description_localizations).toEqual({ de: "Anzahlwert" });

    expect(optQuery.type).toBe(ApplicationCommandOptionType.String);
    expect(optQuery.min_length).toBe(3);
    expect(optQuery.max_length).toBe(50);

    expect(optChannel.type).toBe(ApplicationCommandOptionType.Channel);
    expect(optChannel.channel_types).toEqual([0, 2]);
  });

  it("serializes User and Message context menu commands without description and with correct type", () => {
    const userCommand: CommandDefinition = {
      name: "User Info",
      type: ApplicationCommandType.User,
      nameLocalizations: { de: "Benutzerinfo" },
      run: vi.fn(),
    };

    const messageCommand: CommandDefinition = {
      name: "Bookmark Message",
      type: ApplicationCommandType.Message,
      description: "Should be omitted in Discord JSON",
      run: vi.fn(),
    };

    const userJson = commandToDiscordJson(userCommand);
    expect(userJson.name).toBe("User Info");
    expect(userJson.type).toBe(ApplicationCommandType.User);
    expect(userJson.description).toBeUndefined();
    expect(userJson.name_localizations).toEqual({ de: "Benutzerinfo" });

    const messageJson = commandToDiscordJson(messageCommand);
    expect(messageJson.name).toBe("Bookmark Message");
    expect(messageJson.type).toBe(ApplicationCommandType.Message);
    expect(messageJson.description).toBeUndefined();
  });

  it("CommandInteraction handles User context menu interactions correctly", () => {
    const mockRest = {} as any;
    const interactionPayload: any = {
      id: "int-123",
      application_id: "app-123",
      token: "tok-123",
      type: InteractionType.ApplicationCommand,
      data: {
        id: "cmd-1",
        name: "User Info",
        type: ApplicationCommandType.User,
        target_id: "user-target-456",
        resolved: {
          users: {
            "user-target-456": {
              id: "user-target-456",
              username: "targetuser",
              discriminator: "0",
            },
          },
          members: {
            "user-target-456": {
              nick: "Target Nick",
              roles: ["role-1"],
            },
          },
        },
      },
      user: {
        id: "caller-1",
        username: "caller",
        discriminator: "0",
      },
    };

    const interaction = new CommandInteraction(interactionPayload, mockRest);

    expect(interaction.isChatInputCommand()).toBe(false);
    expect(interaction.isUserContextMenu()).toBe(true);
    expect(interaction.isMessageContextMenu()).toBe(false);
    expect(interaction.isContextMenu()).toBe(true);
    expect(interaction.targetId).toBe("user-target-456");

    const targetUser = interaction.getTargetUser();
    expect(targetUser).toBeDefined();
    expect(targetUser?.username).toBe("targetuser");
    expect(targetUser?.tag).toBe("targetuser");

    const targetMember = interaction.getTargetMember();
    expect(targetMember?.nick).toBe("Target Nick");
  });

  it("CommandInteraction handles Message context menu interactions correctly", () => {
    const mockRest = {} as any;
    const interactionPayload: any = {
      id: "int-456",
      application_id: "app-123",
      token: "tok-123",
      type: InteractionType.ApplicationCommand,
      data: {
        id: "cmd-2",
        name: "Bookmark Message",
        type: ApplicationCommandType.Message,
        target_id: "msg-789",
        resolved: {
          messages: {
            "msg-789": {
              id: "msg-789",
              content: "Hello from discord!",
              author: { id: "author-1", username: "author", discriminator: "0" },
            },
          },
        },
      },
      user: {
        id: "caller-1",
        username: "caller",
        discriminator: "0",
      },
    };

    const interaction = new CommandInteraction(interactionPayload, mockRest);

    expect(interaction.isChatInputCommand()).toBe(false);
    expect(interaction.isUserContextMenu()).toBe(false);
    expect(interaction.isMessageContextMenu()).toBe(true);
    expect(interaction.isContextMenu()).toBe(true);
    expect(interaction.targetId).toBe("msg-789");

    const targetMsg = interaction.getTargetMessage();
    expect(targetMsg).toBeDefined();
    expect(targetMsg?.content).toBe("Hello from discord!");
  });

  it("FileRouter resolves commands with getCommand() distinguishing context menus", () => {
    const router = new FileRouter("/fake");
    const chatCmd: CommandDefinition = {
      name: "info",
      description: "Chat info command",
      type: ApplicationCommandType.ChatInput,
      run: vi.fn(),
    };
    const userCmd: CommandDefinition = {
      name: "info",
      type: ApplicationCommandType.User,
      run: vi.fn(),
    };

    router.commands.set("info", chatCmd);
    router.commands.set(`${ApplicationCommandType.User}:info`, userCmd);

    expect(router.getCommand("info", ApplicationCommandType.ChatInput)).toBe(chatCmd);
    expect(router.getCommand("info", ApplicationCommandType.User)).toBe(userCmd);
  });
});
