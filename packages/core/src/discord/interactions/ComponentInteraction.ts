import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
  type InteractionReplyOptions,
  ComponentType,
} from "../types/interactions.js";
import type { DiscordUser, DiscordMember, DiscordMessage } from "../types/entities.js";
import { PermissionsBitField } from "../types/permissions.js";
import type { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";

export class ComponentInteraction {
  public raw: DiscordInteraction;
  public id: string;
  public applicationId: string;
  public token: string;
  public customId: string;
  public componentType: ComponentType;
  public values: string[];
  public message?: DiscordMessage;
  public user: DiscordUser;
  public member?: DiscordMember;
  public guildId?: string;
  public channelId?: string;
  public memberPermissions: PermissionsBitField;

  public replied = false;
  public deferred = false;
  private rest: RestClient;

  constructor(interaction: DiscordInteraction, rest: RestClient) {
    this.raw = interaction;
    this.id = interaction.id;
    this.applicationId = interaction.application_id;
    this.token = interaction.token;
    this.customId = interaction.data?.custom_id || "";
    this.componentType = interaction.data?.component_type || ComponentType.Button;
    this.values = interaction.data?.values || [];
    this.message = interaction.message;
    this.user = interaction.user || interaction.member?.user!;
    this.member = interaction.member;
    this.guildId = interaction.guild_id;
    this.channelId = interaction.channel_id;
    this.memberPermissions = new PermissionsBitField(
      interaction.member?.permissions || interaction.app_permissions || 0n
    );
    this.rest = rest;
  }

  public isButton(): boolean {
    return this.componentType === ComponentType.Button;
  }

  public isAnySelectMenu(): boolean {
    return (
      this.componentType === ComponentType.StringSelect ||
      this.componentType === ComponentType.UserSelect ||
      this.componentType === ComponentType.RoleSelect ||
      this.componentType === ComponentType.MentionableSelect ||
      this.componentType === ComponentType.ChannelSelect
    );
  }

  public async reply(options: string | InteractionReplyOptions): Promise<void> {
    const payload = this.normalizeReplyOptions(options);
    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: payload,
      },
      auth: false,
    });
    this.replied = true;
  }

  public async update(options: string | InteractionReplyOptions): Promise<void> {
    const payload = this.normalizeReplyOptions(options);
    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.UpdateMessage,
        data: payload,
      },
      auth: false,
    });
    this.replied = true;
  }

  public async deferUpdate(): Promise<void> {
    if (this.replied || this.deferred) return;
    await this.rest.post(Endpoints.interactionCallback(this.id, this.token), {
      body: {
        type: InteractionResponseType.DeferredUpdateMessage,
      },
      auth: false,
    });
    this.deferred = true;
  }

  public async editReply(options: string | InteractionReplyOptions): Promise<any> {
    const payload = this.normalizeReplyOptions(options);
    return this.rest.patch(
      Endpoints.originalInteractionResponse(this.applicationId, this.token),
      {
        body: payload,
        auth: false,
      }
    );
  }

  private normalizeReplyOptions(options: string | InteractionReplyOptions): any {
    if (typeof options === "string") return { content: options };

    const body: any = {};
    if (options.content !== undefined) body.content = options.content;
    if (options.embeds !== undefined) {
      body.embeds = options.embeds.map((e: any) => (typeof e.toJSON === "function" ? e.toJSON() : e));
    }
    if (options.components !== undefined) {
      body.components = options.components.map((c: any) =>
        typeof c.toJSON === "function" ? c.toJSON() : c
      );
    }
    if (options.ephemeral) {
      body.flags = MessageFlags.Ephemeral;
    }
    return body;
  }
}
