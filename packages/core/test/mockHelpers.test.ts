import { describe, it, expect } from "vitest";
import {
  createMockInteraction,
  createMockClient,
  createMockRouteContext,
} from "../src/testing/index.js";
import {
  ModalBuilder,
  TextInputBuilder,
} from "../src/discord/builders/ComponentBuilders.js";
import { TextInputStyle } from "../src/discord/types/interactions.js";

describe("P3.15: Test helpers (createMockInteraction, createMockClient, createMockRouteContext)", () => {
  it("createMockInteraction produces working CommandInteraction with reply & option tracking", async () => {
    const interaction = createMockInteraction({
      commandName: "ban",
      subcommand: "member",
      guildId: "guild-123",
      options: {
        reason: "Spamming in general",
        days: 7,
        notify: true,
      },
      user: {
        id: "mod-456",
        username: "Moderator",
      },
    });

    expect(interaction.commandName).toBe("ban");
    expect(interaction.inGuild()).toBe(true);
    expect(interaction.guildId).toBe("guild-123");
    expect(interaction.user.username).toBe("Moderator");

    expect(interaction.options.getSubcommand()).toBe("member");
    expect(interaction.options.getString("reason")).toBe("Spamming in general");
    expect(interaction.options.getInteger("days")).toBe(7);
    expect(interaction.options.getBoolean("notify")).toBe(true);

    // Test reply
    await interaction.reply({ content: "Banned successfully!" });
    expect(interaction.replied).toBe(true);
    expect(interaction.replies).toHaveLength(1);
    expect(interaction.replies[0].content).toBe("Banned successfully!");

    // Test defer on another mock interaction
    const deferInteraction = createMockInteraction();
    await deferInteraction.deferReply({ ephemeral: true });
    expect(deferInteraction.deferred).toBe(true);
    expect(deferInteraction.defers).toHaveLength(1);
    expect(deferInteraction.defers[0].ephemeral).toBe(true);

    // Test showModal on an unreplied interaction
    const modalInteraction = createMockInteraction();
    const modal = new ModalBuilder()
      .setCustomId("ban_reason_modal")
      .setTitle("Ban Reason")
      .addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
      );

    await modalInteraction.showModal(modal);
    expect(modalInteraction.modals).toHaveLength(1);
    expect(modalInteraction.replied).toBe(true);
  });

  it("createMockClient provides ready client with ws ping and caches", () => {
    const client = createMockClient();

    expect(client.isReady()).toBe(true);
    expect(client.user?.username).toBe("ShardBot");
    expect(client.ws.ping).toBe(25);
    expect(client.guilds).toBeDefined();
    expect(client.channels).toBeDefined();
    expect(client.users).toBeDefined();
  });

  it("createMockRouteContext creates request and context for testing API routes", async () => {
    const ctx = createMockRouteContext({
      method: "POST",
      pathname: "/api/guilds/123/settings",
      params: { id: "123" },
      body: { prefix: "!" },
    });

    expect(ctx.request.method).toBe("POST");
    expect(ctx.params.id).toBe("123");
    expect(ctx.url.pathname).toBe("/api/guilds/123/settings");
    expect(ctx.bot).toBeDefined();

    const json = await ctx.request.json();
    expect(json).toEqual({ prefix: "!" });
  });
});
