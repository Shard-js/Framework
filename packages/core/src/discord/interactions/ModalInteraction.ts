import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
  type InteractionReplyOptions,
} from "../types/interactions.js";
import type { DiscordUser, DiscordMember } from "../types/entities.js";
import type { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";

export class ModalInteraction {
  public raw: DiscordInteraction;
  public id: string;
  public applicationId: string;
  public token: string;
  public customId: string;
  public user: DiscordUser;
  public member?: DiscordMember;
  public guildId?: string;
  public channelId?: string;
  public fields: ModalFieldsResolver;

  public replied = false;
  public deferred = false;
  private rest: RestClient;

  constructor(interaction: DiscordInteraction, rest: RestClient) {
    this.raw = interaction;
    this.id = interaction.id;
    this.applicationId = interaction.application_id;
    this.token = interaction.token;
    this.customId = interaction.data?.custom_id || "";
    this.user = interaction.user || interaction.member?.user!;
    this.member = interaction.member;
    this.guildId = interaction.guild_id;
    this.channelId = interaction.channel_id;
    this.rest = rest;
    this.fields = new ModalFieldsResolver(interaction);
  }

  public isModalSubmit(): this is ModalInteraction {
    return true;
  }

  public async reply(options: string | InteractionReplyOptions): Promise<void> {
    const payload = typeof options === "string" ? { content: options } : options;
    const body: any = { ...payload };
    if (payload.ephemeral) {
      body.flags = MessageFlags.Ephemeral;
    }
    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: body,
      },
      auth: false,
    });
    this.replied = true;
  }

  public async deferReply(options?: { ephemeral?: boolean }): Promise<void> {
    if (this.replied || this.deferred) return;
    let flags = 0;
    if (options?.ephemeral) {
      flags |= MessageFlags.Ephemeral;
    }
    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: flags > 0 ? { flags } : undefined,
      },
      auth: false,
    });
    this.deferred = true;
  }

  public async editReply(options: string | InteractionReplyOptions): Promise<any> {
    const payload = typeof options === "string" ? { content: options } : options;
    const body: any = { ...payload };
    if (payload.ephemeral) {
      body.flags = MessageFlags.Ephemeral;
    }
    return this.rest.patch(
      Endpoints.originalInteractionResponse(this.applicationId, this.token),
      {
        body,
        auth: false,
      }
    );
  }
}

export class ModalFieldsResolver {
  private values = new Map<string, string>();

  constructor(interaction: DiscordInteraction) {
    const rows = interaction.data?.components || [];
    for (const row of rows) {
      for (const component of row.components || []) {
        if (component.custom_id && component.value !== undefined) {
          this.values.set(component.custom_id, component.value);
        }
      }
    }
  }

  public getTextInputValue(customId: string): string | null {
    return this.values.get(customId) || null;
  }
}
