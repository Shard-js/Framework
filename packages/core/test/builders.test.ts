import { describe, it, expect } from "vitest";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  ModalBuilder,
} from "../src/discord/builders/index.js";
import { ComponentType, ButtonStyle, TextInputStyle } from "../src/discord/types/interactions.js";

describe("Discord Builders", () => {
  it("builds a rich embed", () => {
    const embed = new EmbedBuilder()
      .setTitle("Test Embed")
      .setDescription("Embed description")
      .setColor("#ff0000")
      .addFields(
        { name: "Field 1", value: "Value 1", inline: true },
        { name: "Field 2", value: "Value 2" }
      )
      .setFooter({ text: "Footer text" })
      .toJSON();

    expect(embed.title).toBe("Test Embed");
    expect(embed.description).toBe("Embed description");
    expect(embed.color).toBe(0xff0000);
    expect(embed.fields).toHaveLength(2);
    expect(embed.footer?.text).toBe("Footer text");
  });

  it("builds an action row with buttons", () => {
    const btn1 = new ButtonBuilder()
      .setCustomId("primary_btn")
      .setLabel("Click Me")
      .setStyle(ButtonStyle.Primary);

    const btn2 = new ButtonBuilder()
      .setURL("https://example.com")
      .setLabel("Link")
      .setStyle(ButtonStyle.Link);

    const row = new ActionRowBuilder().addComponents(btn1, btn2).toJSON();

    expect(row.type).toBe(ComponentType.ActionRow);
    expect(row.components).toHaveLength(2);
    expect(row.components?.[0].custom_id).toBe("primary_btn");
    expect(row.components?.[1].url).toBe("https://example.com");
  });

  it("builds a string select menu", () => {
    const select = new StringSelectMenuBuilder()
      .setCustomId("my_select")
      .setPlaceholder("Choose an option")
      .setMinValues(1)
      .setMaxValues(2)
      .addOptions(
        { label: "Option A", value: "opt_a" },
        { label: "Option B", value: "opt_b" }
      )
      .toJSON();

    expect(select.type).toBe(ComponentType.StringSelect);
    expect(select.custom_id).toBe("my_select");
    expect(select.placeholder).toBe("Choose an option");
    expect(select.options).toHaveLength(2);
  });

  it("builds a modal with text input", () => {
    const input = new TextInputBuilder()
      .setCustomId("reason_input")
      .setLabel("Reason")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);

    const modal = new ModalBuilder()
      .setCustomId("ban_modal")
      .setTitle("Ban User")
      .addComponents(row)
      .toJSON();

    expect(modal.custom_id).toBe("ban_modal");
    expect(modal.title).toBe("Ban User");
    expect(modal.components).toHaveLength(1);
    expect(modal.components[0].components?.[0].custom_id).toBe("reason_input");
  });
});
