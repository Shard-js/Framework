import { describe, it, expect } from "vitest";
import {
  SlashCommandBuilder,
  defineCommand,
  ApplicationCommandType,
  PermissionFlagsBits,
} from "../src/index.js";

describe("SlashCommandBuilder & Fluent API", () => {
  it("builds a command definition with options and permissions", () => {
    const builder = new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user from the guild")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .setDMPermission(false)
      .addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("The user to ban")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for the ban")
          .setRequired(false)
          .setMinLength(3)
          .setMaxLength(500)
          .addChoices(
            { name: "Spamming", value: "spam" },
            { name: "Harassment", value: "harassment" }
          )
      )
      .addIntegerOption((opt) =>
        opt
          .setName("delete-days")
          .setDescription("Number of days of messages to delete")
          .setMinValue(0)
          .setMaxValue(7)
      );

    const json = builder.toJSON();

    expect(json.name).toBe("ban");
    expect(json.description).toBe("Ban a user from the guild");
    expect(json.type).toBe(ApplicationCommandType.ChatInput);
    expect(json.dmPermission).toBe(false);
    expect(json.defaultMemberPermissions).toBe(PermissionFlagsBits.BanMembers);
    expect(json.options).toHaveLength(3);

    const targetOpt = json.options![0];
    expect(targetOpt.name).toBe("target");
    expect(targetOpt.type).toBe("User");
    expect(targetOpt.required).toBe(true);

    const reasonOpt: any = json.options![1];
    expect(reasonOpt.name).toBe("reason");
    expect(reasonOpt.type).toBe("String");
    expect(reasonOpt.minLength).toBe(3);
    expect(reasonOpt.maxLength).toBe(500);
    expect(reasonOpt.choices).toEqual([
      { name: "Spamming", value: "spam" },
      { name: "Harassment", value: "harassment" },
    ]);

    const deleteOpt: any = json.options![2];
    expect(deleteOpt.name).toBe("delete-days");
    expect(deleteOpt.type).toBe("Integer");
    expect(deleteOpt.minValue).toBe(0);
    expect(deleteOpt.maxValue).toBe(7);
  });

  it("builds subcommands and subcommand groups", () => {
    const builder = new SlashCommandBuilder()
      .setName("config")
      .setDescription("Manage configuration")
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View current config")
      )
      .addSubcommandGroup((group) =>
        group
          .setName("logging")
          .setDescription("Manage logging config")
          .addSubcommand((sub) =>
            sub
              .setName("set-channel")
              .setDescription("Set logging channel")
              .addChannelOption((ch) =>
                ch.setName("channel").setDescription("Target channel").setRequired(true)
              )
          )
      );

    const json = builder.toJSON();
    expect(json.options).toHaveLength(2);
    expect(json.options![0].type).toBe("Subcommand");
    expect(json.options![0].name).toBe("view");
    expect(json.options![1].type).toBe("SubcommandGroup");
    expect(json.options![1].name).toBe("logging");
  });

  it("seamlessly integrates with defineCommand via data property", () => {
    const cmd = defineCommand({
      data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with pong!"),
      async run(ctx) {
        return "pong";
      },
    });

    expect(cmd.name).toBe("ping");
    expect(cmd.description).toBe("Replies with pong!");
    expect(typeof cmd.run).toBe("function");
  });
});
