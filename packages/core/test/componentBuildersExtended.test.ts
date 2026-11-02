import { describe, it, expect } from "vitest";
import {
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ComponentType,
  ButtonStyle,
} from "../src/index.js";

describe("Component Builders Extended", () => {
  it("creates UserSelectMenuBuilder and adds to ActionRow", () => {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId("select-user")
      .setPlaceholder("Pick a user")
      .setMinValues(1)
      .setMaxValues(3)
      .setDefaultUsers("123", "456");

    const row = new ActionRowBuilder().addComponents(userSelect);
    const json = row.toJSON();

    expect(json.type).toBe(ComponentType.ActionRow);
    expect(json.components).toHaveLength(1);
    expect(json.components![0].type).toBe(ComponentType.UserSelect);
    expect(json.components![0].custom_id).toBe("select-user");
    expect(json.components![0].min_values).toBe(1);
    expect(json.components![0].max_values).toBe(3);
    expect(json.components![0].default_values).toEqual([
      { id: "123", type: "user" },
      { id: "456", type: "user" },
    ]);
  });

  it("creates ChannelSelectMenuBuilder with channel types filter", () => {
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId("select-channel")
      .setPlaceholder("Pick an announcement channel")
      .addChannelTypes(0, 5); // 0 = text, 5 = announcement

    const json = channelSelect.toJSON();
    expect(json.type).toBe(ComponentType.ChannelSelect);
    expect(json.channel_types).toEqual([0, 5]);
  });

  it("creates RoleSelectMenuBuilder and MentionableSelectMenuBuilder", () => {
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId("select-role")
      .setDefaultRoles("999");
    expect(roleSelect.toJSON().type).toBe(ComponentType.RoleSelect);
    expect(roleSelect.toJSON().default_values).toEqual([{ id: "999", type: "role" }]);

    const mentionable = new MentionableSelectMenuBuilder()
      .setCustomId("select-mentionable")
      .setDefaultValues({ id: "111", type: "user" });
    expect(mentionable.toJSON().type).toBe(ComponentType.MentionableSelect);
    expect(mentionable.toJSON().default_values).toEqual([{ id: "111", type: "user" }]);
  });
});
