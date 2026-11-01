import { CommandInteraction } from "../discord/interactions/CommandInteraction.js";
import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  InteractionType,
  type DiscordInteraction,
} from "../discord/types/interactions.js";
import { Client, type ClientOptions } from "../discord/client/Client.js";
import type { RouteHandlerContext } from "@shardjs/api";

export interface MockInteractionOptions {
  id?: string;
  applicationId?: string;
  token?: string;
  commandName?: string;
  commandType?: ApplicationCommandType;
  options?: Record<string, string | number | boolean>;
  subcommand?: string;
  subcommandGroup?: string;
  user?: { id?: string; username?: string; discriminator?: string; tag?: string };
  member?: any;
  guildId?: string;
  channelId?: string;
  rest?: any;
}

export function createMockInteraction(
  options: MockInteractionOptions = {}
): CommandInteraction & { replies: any[]; defers: any[]; modals: any[] } {
  const replies: any[] = [];
  const defers: any[] = [];
  const modals: any[] = [];

  const rawOptions: any[] = [];
  if (options.options) {
    for (const [name, value] of Object.entries(options.options)) {
      let type = ApplicationCommandOptionType.String;
      if (typeof value === "number") type = ApplicationCommandOptionType.Integer;
      else if (typeof value === "boolean") type = ApplicationCommandOptionType.Boolean;
      rawOptions.push({ name, value, type });
    }
  }

  let finalOptions = rawOptions;
  if (options.subcommand) {
    finalOptions = [
      {
        name: options.subcommand,
        type: ApplicationCommandOptionType.Subcommand,
        options: rawOptions,
      },
    ];
  }
  if (options.subcommandGroup) {
    finalOptions = [
      {
        name: options.subcommandGroup,
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: finalOptions,
      },
    ];
  }

  const rawInteraction: DiscordInteraction = {
    id: options.id || "mock-interaction-id",
    application_id: options.applicationId || "mock-app-id",
    token: options.token || "mock-token",
    type: InteractionType.ApplicationCommand,
    data: {
      id: "mock-cmd-id",
      name: options.commandName || "test",
      type: options.commandType || ApplicationCommandType.ChatInput,
      options: finalOptions,
    },
    user: {
      id: options.user?.id || "mock-user-id",
      username: options.user?.username || "mockuser",
      discriminator: options.user?.discriminator || "0",
      avatar: null,
    },
    member: options.member || (options.guildId ? { nick: "MockMember", roles: [] } : undefined),
    guild_id: options.guildId,
    channel_id: options.channelId || "mock-channel-id",
    version: 1,
  };

  const mockRest = options.rest || {
    post: async (url: string, data: any) => {
      return {};
    },
    patch: async (url: string, data: any) => {
      return {};
    },
  };

  const interaction = new CommandInteraction(rawInteraction, mockRest);

  const originalReply = interaction.reply.bind(interaction);
  interaction.reply = async (opts: any) => {
    replies.push(opts);
    return originalReply(opts);
  };

  const originalDefer = interaction.deferReply.bind(interaction);
  interaction.deferReply = async (opts?: any) => {
    defers.push(opts || {});
    return originalDefer(opts);
  };

  const originalModal = interaction.showModal.bind(interaction);
  interaction.showModal = async (modal: any) => {
    modals.push(modal);
    return originalModal(modal);
  };

  Object.assign(interaction, { replies, defers, modals });
  return interaction as any;
}

export function createMockClient(options: Partial<ClientOptions> = {}): Client {
  const client = new Client({
    token: "mock-token",
    intents: 0,
    ...options,
  });

  (client as any).ready = true;
  client.user = {
    id: "mock-bot-id",
    username: "ShardBot",
    discriminator: "0",
    avatar: null,
    tag: "ShardBot#0000",
    avatarURL: () => null,
  };

  Object.defineProperty(client, "ws", {
    value: {
      ping: 25,
      status: 0,
      shards: new Map(),
    },
    configurable: true,
    writable: true,
  });

  return client;
}

export function createMockRouteContext(
  options: {
    method?: string;
    pathname?: string;
    body?: any;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    bot?: any;
    db?: any;
  } = {}
): RouteHandlerContext {
  const method = (options.method || "GET").toUpperCase();
  const url = new URL(`http://localhost:3000${options.pathname || "/"}`);
  const headers = new Headers(options.headers);

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD" && options.body !== undefined) {
    if (typeof options.body === "string" || Buffer.isBuffer(options.body)) {
      body = options.body as any;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
  }

  const request = new Request(url.toString(), {
    method,
    headers,
    body,
    // @ts-ignore
    duplex: "half",
  });

  return {
    request,
    params: options.params || {},
    url,
    bot: options.bot || createMockClient(),
    db: options.db,
  };
}
