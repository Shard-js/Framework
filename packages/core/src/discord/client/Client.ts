import { EventEmitter } from "node:events";
import { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";
import { ShardManager } from "../gateway/ShardManager.js";
import { ClientCache } from "./ClientCache.js";
import type { DiscordUser, DiscordGuild, DiscordChannel, DiscordMessage } from "../types/entities.js";
import { InteractionType } from "../types/interactions.js";
import { CommandInteraction } from "../interactions/CommandInteraction.js";
import { AutocompleteInteraction } from "../interactions/AutocompleteInteraction.js";
import { ComponentInteraction } from "../interactions/ComponentInteraction.js";
import { ModalInteraction } from "../interactions/ModalInteraction.js";
import type { WebSocketFactory } from "../gateway/ws/IWebSocket.js";

export interface ClientCacheOptions {
  guilds?: number;
  channels?: number;
  users?: number;
  messages?: number;
}

export interface ClientOptions {
  token?: string;
  intents?: number;
  totalShards?: number;
  cacheLimits?: ClientCacheOptions;
  wsFactory?: WebSocketFactory;
}

export interface ClientUser extends DiscordUser {
  tag: string;
  avatarURL: () => string | null;
}

export class Client extends EventEmitter {
  public token?: string;
  public intents: number;
  public rest: RestClient;
  public shardManager: ShardManager;

  public user: ClientUser | null = null;
  public guilds: ClientCache<string, any>;
  public channels: ClientCache<string, any>;
  public users: ClientCache<string, any>;

  private ready = false;

  constructor(options: ClientOptions = {}) {
    super();
    this.token = options.token;
    this.intents = options.intents ?? 0;

    this.rest = new RestClient({ token: this.token });
    this.shardManager = new ShardManager({
      token: this.token || "",
      intents: this.intents,
      totalShards: options.totalShards,
      restClient: this.rest,
      wsFactory: options.wsFactory,
    });

    const limits = options.cacheLimits || {};
    this.guilds = new ClientCache({ maxSize: limits.guilds ?? 500 });
    this.channels = new ClientCache({ maxSize: limits.channels ?? 1000 });
    this.users = new ClientCache({ maxSize: limits.users ?? 1000 });

    this.setupGatewayListeners();
  }

  public get ws(): { ping: number; status: string } {
    return {
      ping: this.shardManager.ping,
      status: this.ready ? "READY" : "DISCONNECTED",
    };
  }

  public isReady(): boolean {
    return this.ready;
  }

  public async login(token?: string): Promise<string> {
    if (token) {
      this.token = token;
      this.rest.setToken(token);
    }
    if (!this.token) {
      throw new Error("No bot token provided to client.login().");
    }

    // Connect shard manager to gateway
    await this.shardManager.connect();
    return this.token;
  }

  public async destroy(): Promise<void> {
    this.ready = false;
    this.rest.destroy();
    this.shardManager.destroy();
    this.guilds.destroy();
    this.channels.destroy();
    this.users.destroy();
    this.removeAllListeners();
  }

  private setupGatewayListeners(): void {
    this.shardManager.on("dispatch", (event: string, data: any) => {
      this.handleDispatch(event, data);
    });

    this.shardManager.on("fatal", (err) => {
      this.emit("error", err);
    });
  }

  private handleDispatch(event: string, data: any): void {
    switch (event) {
      case "READY":
        this.handleReady(data);
        break;

      case "GUILD_CREATE":
        this.guilds.set(data.id, this.enrichGuild(data));
        this.emit("guildCreate", this.guilds.get(data.id));
        break;

      case "GUILD_UPDATE":
        this.guilds.set(data.id, this.enrichGuild(data));
        this.emit("guildUpdate", this.guilds.get(data.id));
        break;

      case "GUILD_DELETE":
        this.guilds.delete(data.id);
        this.emit("guildDelete", data);
        break;

      case "CHANNEL_CREATE":
      case "CHANNEL_UPDATE":
        this.channels.set(data.id, this.enrichChannel(data));
        this.emit(event === "CHANNEL_CREATE" ? "channelCreate" : "channelUpdate", this.channels.get(data.id));
        break;

      case "CHANNEL_DELETE":
        this.channels.delete(data.id);
        this.emit("channelDelete", data);
        break;

      case "MESSAGE_CREATE":
        const message = this.enrichMessage(data);
        this.emit("messageCreate", message);
        break;

      case "INTERACTION_CREATE":
        this.handleInteraction(data);
        break;

      default:
        // Dynamic event dispatching (Issue #2 & #16)
        // Convert UPPER_SNAKE_CASE to camelCase: GUILD_MEMBER_ADD -> guildMemberAdd
        const camelEvent = this.toCamelCase(event);
        this.emit(camelEvent, data);
        this.emit(event, data);
        break;
    }
  }

  private handleReady(readyData: any): void {
    const rawUser = readyData.user;
    this.user = {
      ...rawUser,
      tag:
        rawUser.discriminator && rawUser.discriminator !== "0"
          ? `${rawUser.username}#${rawUser.discriminator}`
          : rawUser.username,
      avatarURL: () =>
        rawUser.avatar
          ? `https://cdn.discordapp.com/avatars/${rawUser.id}/${rawUser.avatar}.png`
          : null,
    };

    if (Array.isArray(readyData.guilds)) {
      for (const g of readyData.guilds) {
        if (!this.guilds.has(g.id)) {
          this.guilds.set(g.id, this.enrichGuild(g));
        }
      }
    }

    this.ready = true;
    this.emit("ready", this);
  }

  private handleInteraction(rawInteraction: any): void {
    switch (rawInteraction.type) {
      case InteractionType.ApplicationCommand:
        const cmdInteraction = new CommandInteraction(rawInteraction, this.rest);
        this.emit("interactionCreate", cmdInteraction);
        break;

      case InteractionType.ApplicationCommandAutocomplete:
        const autoInteraction = new AutocompleteInteraction(rawInteraction, this.rest);
        this.emit("interactionCreate", autoInteraction);
        break;

      case InteractionType.MessageComponent:
        const compInteraction = new ComponentInteraction(rawInteraction, this.rest);
        this.emit("interactionCreate", compInteraction);
        break;

      case InteractionType.ModalSubmit:
        const modalInteraction = new ModalInteraction(rawInteraction, this.rest);
        this.emit("interactionCreate", modalInteraction);
        break;

      default:
        this.emit("interactionCreate", rawInteraction);
        break;
    }
  }

  private enrichMessage(data: DiscordMessage): any {
    const client = this;
    return {
      ...data,
      async reply(options: any) {
        const payload = typeof options === "string" ? { content: options } : options;
        return client.rest.post(Endpoints.channelMessages(data.channel_id), {
          body: {
            ...payload,
            message_reference: { message_id: data.id },
          },
        });
      },
      channel: {
        id: data.channel_id,
        async send(options: any) {
          const payload = typeof options === "string" ? { content: options } : options;
          return client.rest.post(Endpoints.channelMessages(data.channel_id), {
            body: payload,
          });
        },
      },
    };
  }

  private enrichGuild(guild: any): any {
    const client = this;
    const channelsCache = new ClientCache<string, any>({ maxSize: 100 });

    if (Array.isArray(guild.channels)) {
      for (const ch of guild.channels) {
        channelsCache.set(ch.id, this.enrichChannel(ch));
      }
    }

    return {
      ...guild,
      iconURL: () =>
        guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
      channels: {
        cache: channelsCache,
      },
      members: {
        async ban(userId: string, options?: { reason?: string; deleteMessageSeconds?: number }) {
          return client.rest.put(Endpoints.guildBan(guild.id, userId), {
            body: {
              reason: options?.reason,
              delete_message_seconds: options?.deleteMessageSeconds,
            },
          });
        },
      },
    };
  }

  private enrichChannel(channel: any): any {
    const client = this;
    return {
      ...channel,
      isTextBased: () => channel.type === 0 || channel.type === 1 || channel.type === 5,
      async send(options: any) {
        const payload = typeof options === "string" ? { content: options } : options;
        return client.rest.post(Endpoints.channelMessages(channel.id), {
          body: payload,
        });
      },
    };
  }

  private toCamelCase(str: string): string {
    return str
      .toLowerCase()
      .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
  }
}
