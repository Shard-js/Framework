import type { DiscordEmbed } from "../types/entities.js";
import { EmbedBuilder } from "./EmbedBuilder.js";
import { ActionRowBuilder, ButtonBuilder } from "./ComponentBuilders.js";
import { ButtonStyle } from "../types/interactions.js";
import type { CommandInteraction } from "../interactions/CommandInteraction.js";
import type { ComponentInteraction } from "../interactions/ComponentInteraction.js";

export interface PaginatorOptions {
  embeds: (DiscordEmbed | EmbedBuilder)[];
  timeout?: number;
  ephemeral?: boolean;
  customIdPrefix?: string;
  showFirstLast?: boolean;
}

export class Paginator {
  public embeds: DiscordEmbed[];
  public currentPage = 0;
  public timeout: number;
  public ephemeral: boolean;
  public customIdPrefix: string;
  public showFirstLast: boolean;

  constructor(options: PaginatorOptions) {
    if (!options.embeds || options.embeds.length === 0) {
      throw new Error("Paginator requires at least one embed.");
    }
    this.embeds = options.embeds.map((e) =>
      typeof (e as any).toJSON === "function" ? (e as any).toJSON() : e
    );
    this.timeout = options.timeout ?? 60_000;
    this.ephemeral = options.ephemeral ?? false;
    this.customIdPrefix =
      options.customIdPrefix ??
      `paginator_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.showFirstLast = options.showFirstLast ?? this.embeds.length > 2;
  }

  public getActionRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
    const isFirst = this.currentPage === 0;
    const isLast = this.currentPage === this.embeds.length - 1;

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (this.showFirstLast) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${this.customIdPrefix}_first`)
          .setLabel("⏮")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || isFirst)
      );
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${this.customIdPrefix}_prev`)
        .setLabel("◀")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || isFirst),
      new ButtonBuilder()
        .setCustomId(`${this.customIdPrefix}_page`)
        .setLabel(`${this.currentPage + 1} / ${this.embeds.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`${this.customIdPrefix}_next`)
        .setLabel("▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled || isLast)
    );

    if (this.showFirstLast) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${this.customIdPrefix}_last`)
          .setLabel("⏭")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || isLast)
      );
    }

    return row;
  }

  public getCurrentEmbed(): DiscordEmbed {
    return this.embeds[this.currentPage];
  }

  public async send(
    target: CommandInteraction | ComponentInteraction
  ): Promise<any> {
    const embed = this.getCurrentEmbed();
    const row = this.getActionRow();

    if (target.replied || target.deferred) {
      return await target.editReply({
        embeds: [embed],
        components: this.embeds.length > 1 ? [row.toJSON()] : undefined,
      });
    }

    return await target.reply({
      embeds: [embed],
      components: this.embeds.length > 1 ? [row.toJSON()] : undefined,
      ephemeral: this.ephemeral,
    });
  }

  public handleButton(customId: string): boolean {
    if (!customId.startsWith(this.customIdPrefix)) return false;
    const action = customId.replace(`${this.customIdPrefix}_`, "");

    if (action === "first") {
      this.currentPage = 0;
      return true;
    }
    if (action === "prev" && this.currentPage > 0) {
      this.currentPage--;
      return true;
    }
    if (action === "next" && this.currentPage < this.embeds.length - 1) {
      this.currentPage++;
      return true;
    }
    if (action === "last") {
      this.currentPage = this.embeds.length - 1;
      return true;
    }
    return false;
  }
}
