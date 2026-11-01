import { describe, it, expect, vi } from "vitest";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import { ComponentInteraction } from "../src/discord/interactions/ComponentInteraction.js";
import { ModalBuilder, TextInputBuilder, ActionRowBuilder } from "../src/discord/builders/ComponentBuilders.js";
import { InteractionResponseType } from "../src/discord/types/interactions.js";

describe("showModal implementation (P0 Issue #3)", () => {
  it("CommandInteraction.showModal sends modal response callback with type 9 and auth: false", async () => {
    const mockPost = vi.fn().mockResolvedValue({});
    const fakeRest = { post: mockPost } as any;

    const interaction = new CommandInteraction(
      {
        id: "int-123",
        application_id: "app-456",
        token: "tok-789",
        version: 1,
        type: 2,
        data: { name: "feedback" },
      } as any,
      fakeRest
    );

    const modal = new ModalBuilder()
      .setCustomId("modal-feedback")
      .setTitle("Feedback Form")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId("input-text").setLabel("Your Feedback")
        )
      );

    await interaction.showModal(modal);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = mockPost.mock.calls[0];
    expect(endpoint).toBe("/interactions/int-123/tok-789/callback");
    expect(payload.auth).toBe(false);
    expect(payload.body.type).toBe(InteractionResponseType.Modal);
    expect(payload.body.data.custom_id).toBe("modal-feedback");
    expect(payload.body.data.title).toBe("Feedback Form");
    expect(payload.body.data.components).toHaveLength(1);
    expect(interaction.replied).toBe(true);
  });

  it("ComponentInteraction.showModal sends modal response callback", async () => {
    const mockPost = vi.fn().mockResolvedValue({});
    const fakeRest = { post: mockPost } as any;

    const interaction = new ComponentInteraction(
      {
        id: "int-btn-1",
        application_id: "app-456",
        token: "tok-btn",
        version: 1,
        type: 3,
        data: { custom_id: "open-feedback-button", component_type: 2 },
      } as any,
      fakeRest
    );

    const modal = new ModalBuilder()
      .setCustomId("modal-btn-feedback")
      .setTitle("Button Feedback");

    await interaction.showModal(modal);

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = mockPost.mock.calls[0];
    expect(endpoint).toBe("/interactions/int-btn-1/tok-btn/callback");
    expect(payload.auth).toBe(false);
    expect(payload.body.type).toBe(9);
    expect(payload.body.data.custom_id).toBe("modal-btn-feedback");
    expect(interaction.replied).toBe(true);
  });

  it("throws if interaction was already replied to or deferred", async () => {
    const mockPost = vi.fn().mockResolvedValue({});
    const fakeRest = { post: mockPost } as any;

    const interaction = new CommandInteraction(
      {
        id: "int-123",
        application_id: "app-456",
        token: "tok-789",
        version: 1,
        type: 2,
        data: { name: "feedback" },
      } as any,
      fakeRest
    );

    interaction.replied = true;
    await expect(
      interaction.showModal({ custom_id: "test", title: "Test", components: [] })
    ).rejects.toThrow(/already been replied to/);
  });
});
