import { describe, it, expect } from "vitest";
import { commandToDiscordJson } from "../src/deploy/deployCommands.js";
import { PermissionFlagsBits } from "../src/discord/types/permissions.js";
import type { CommandDefinition } from "../src/types/index.js";

describe("commandToDiscordJson", () => {
  it("transforms a basic slash command with flat options", () => {
    const cmd: CommandDefinition = {
      name: "ping",
      description: "Replies with pong",
      guildOnly: true,
      defaultMemberPermissions: PermissionFlagsBits.SendMessages,
      options: [
        {
          name: "ephemeral",
          description: "Hide response",
          type: "Boolean",
          required: false,
        },
      ],
      run: () => {},
    };

    const json = commandToDiscordJson(cmd);
    expect(json.name).toBe("ping");
    expect(json.description).toBe("Replies with pong");
    expect(json.dm_permission).toBe(false);
    expect(json.default_member_permissions).toBe(
      PermissionFlagsBits.SendMessages.toString()
    );
    expect(json.options).toHaveLength(1);
    expect(json.options[0].type).toBe(5); // Boolean
    expect(json.options[0].name).toBe("ephemeral");
  });

  it("supports subcommands and subcommand groups (Issue #2)", () => {
    const cmd: CommandDefinition = {
      name: "config",
      description: "Manage server configuration",
      options: [
        {
          name: "set",
          description: "Set a config variable",
          type: "Subcommand",
          options: [
            {
              name: "key",
              description: "The setting key",
              type: "String",
              required: true,
            },
            {
              name: "val",
              description: "The setting value",
              type: "String",
              required: true,
            },
          ],
        },
        {
          name: "advanced",
          description: "Advanced config settings",
          type: "SubcommandGroup",
          options: [
            {
              name: "reset",
              description: "Reset advanced settings",
              type: "Subcommand",
              options: [],
            },
          ],
        },
      ],
      run: () => {},
    };

    const json = commandToDiscordJson(cmd);
    expect(json.name).toBe("config");
    expect(json.options).toHaveLength(2);

    // Subcommand type 1
    const subCmd = json.options[0];
    expect(subCmd.type).toBe(1);
    expect(subCmd.name).toBe("set");
    expect(subCmd.options).toHaveLength(2);
    expect(subCmd.options[0].type).toBe(3); // String

    // SubcommandGroup type 2
    const subGroup = json.options[1];
    expect(subGroup.type).toBe(2);
    expect(subGroup.name).toBe("advanced");
    expect(subGroup.options).toHaveLength(1);
    expect(subGroup.options[0].type).toBe(1); // Nested Subcommand
    expect(subGroup.options[0].name).toBe("reset");
  });
});
