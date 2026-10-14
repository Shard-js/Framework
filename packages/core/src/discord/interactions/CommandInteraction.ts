import {
  InteractionResponseType,
  MessageFlags,
  type DiscordInteraction,
  type DiscordInteractionDataOption,
  type InteractionReplyOptions,
} from "../types/interactions.js";
import type { DiscordUser, DiscordMember } from "../types/entities.js";
import { PermissionsBitField } from "../types/permissions.js";
import type { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";

export class CommandInteraction {
  public raw: DiscordInteraction;
  public id: string;
  public applicationId: string;
  public token: string;
  public commandName: string;
  public user: DiscordUser;
  public member?: DiscordMember;
  public guildId?: string;
  public channelId?: string;
  public memberPermissions: PermissionsBitField;

  public replied = false;
  public deferred = false;

  public options: CommandOptionResolver;
  private rest: RestClient;

  constructor(interaction: DiscordInteraction, rest: RestClient) {
    this.raw = interaction;
    this.id = interaction.id;
    this.applicationId = interaction.application_id;
    this.token = interaction.token;
    this.commandName = interaction.data?.name || "";
    this.user = interaction.user || interaction.member?.user!;
    this.member = interaction.member;
    this.guildId = interaction.guild_id;
    this.channelId = interaction.channel_id;
    this.memberPermissions = new PermissionsBitField(
      interaction.member?.permissions || interaction.app_permissions || 0n
    );
    this.rest = rest;
    this.options = new CommandOptionResolver(interaction);
  }

  public inGuild(): boolean {
    return Boolean(this.guildId);
  }

  public isChatInputCommand(): this is CommandInteraction {
    return true;
  }

  public isAutocomplete(): boolean {
    return false;
  }

  public isButton(): boolean {
    return false;
  }

  public isAnySelectMenu(): boolean {
    return false;
  }

  public isModalSubmit(): boolean {
    return false;
  }

  public async reply(options: string | InteractionReplyOptions): Promise<void> {
    if (this.replied || this.deferred) {
      await this.editReply(options);
      return;
    }

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
    const payload = this.normalizeReplyOptions(options);
    return this.rest.patch(
      Endpoints.originalInteractionResponse(this.applicationId, this.token),
      {
        body: payload,
        auth: false,
      }
    );
  }

  public async deleteReply(): Promise<void> {
    await this.rest.delete(
      Endpoints.originalInteractionResponse(this.applicationId, this.token),
      { auth: false }
    );
    this.replied = false;
  }

  public async followUp(options: string | InteractionReplyOptions): Promise<any> {
    const payload = this.normalizeReplyOptions(options);
    return this.rest.post(Endpoints.followupMessage(this.applicationId, this.token), {
      body: payload,
      auth: false,
    });
  }

  private normalizeReplyOptions(options: string | InteractionReplyOptions): any {
    if (typeof options === "string") {
      return { content: options };
    }

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
    if (options.tts) {
      body.tts = true;
    }
    if (options.allowedMentions) {
      body.allowed_mentions = options.allowedMentions;
    }
    return body;
  }
}

export class CommandOptionResolver {
  private rawOptions: DiscordInteractionDataOption[] = [];
  private resolved: any = {};
  private subcommand: string | null = null;
  private subcommandGroup: string | null = null;

  constructor(interaction: DiscordInteraction) {
    this.resolved = interaction.data?.resolved || {};
    let currentOptions = interaction.data?.options || [];

    // Find subcommand group or subcommand
    if (currentOptions.length === 1 && currentOptions[0].type === 2) {
      // SubcommandGroup
      this.subcommandGroup = currentOptions[0].name;
      currentOptions = currentOptions[0].options || [];
    }

    if (currentOptions.length === 1 && currentOptions[0].type === 1) {
      // Subcommand
      this.subcommand = currentOptions[0].name;
      currentOptions = currentOptions[0].options || [];
    }

    this.rawOptions = currentOptions;
  }

  public getSubcommand(required = false): string | null {
    if (required && !this.subcommand) {
      throw new Error("Missing required subcommand.");
    }
    return this.subcommand;
  }

  public getSubcommandGroup(required = false): string | null {
    if (required && !this.subcommandGroup) {
      throw new Error("Missing required subcommand group.");
    }
    return this.subcommandGroup;
  }

  public get(name: string, required = false): DiscordInteractionDataOption | null {
    const opt = this.rawOptions.find((o) => o.name === name);
    if (!opt && required) {
      throw new Error(`Missing required command option: "${name}"`);
    }
    return opt || null;
  }

  public getString(name: string, required = false): string | null {
    const opt = this.get(name, required);
    return opt?.value !== undefined ? String(opt.value) : null;
  }

  public getInteger(name: string, required = false): number | null {
    const opt = this.get(name, required);
    return opt?.value !== undefined ? Math.floor(Number(opt.value)) : null;
  }

  public getNumber(name: string, required = false): number | null {
    const opt = this.get(name, required);
    return opt?.value !== undefined ? Number(opt.value) : null;
  }

  public getBoolean(name: string, required = false): boolean | null {
    const opt = this.get(name, required);
    return opt?.value !== undefined ? Boolean(opt.value) : null;
  }

  public getUser(name: string, required = false): (DiscordUser & { tag: string }) | null {
    const opt = this.get(name, required);
    if (!opt?.value) return null;
    const userId = String(opt.value);
    const user = this.resolved.users?.[userId];
    if (!user) return null;
    return {
      ...user,
      tag: user.discriminator && user.discriminator !== "0"
        ? `${user.username}#${user.discriminator}`
        : user.username,
    };
  }

  public getMember(name: string, required = false): DiscordMember | null {
    const opt = this.get(name, required);
    if (!opt?.value) return null;
    const userId = String(opt.value);
    return this.resolved.members?.[userId] || null;
  }

  public getRole(name: string, required = false): any | null {
    const opt = this.get(name, required);
    if (!opt?.value) return null;
    return this.resolved.roles?.[String(opt.value)] || null;
  }

  public getChannel(name: string, required = false): any | null {
    const opt = this.get(name, required);
    if (!opt?.value) return null;
    return this.resolved.channels?.[String(opt.value)] || null;
  }

  public getAttachment(name: string, required = false): any | null {
    const opt = this.get(name, required);
    if (!opt?.value) return null;
    return this.resolved.attachments?.[String(opt.value)] || null;
  }
}
