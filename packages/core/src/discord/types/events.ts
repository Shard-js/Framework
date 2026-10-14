import type {
  DiscordGuild,
  DiscordMessage,
  DiscordChannel,
  DiscordMember,
  DiscordRole,
  DiscordUser,
} from "./entities.js";
import type { DiscordInteraction } from "./interactions.js";
import type { Client } from "../client/Client.js";

export interface ClientMessage extends DiscordMessage {
  reply: (options: string | { content?: string; embeds?: any[]; components?: any[]; message_reference?: any }) => Promise<any>;
  channel: {
    id: string;
    send: (options: string | { content?: string; embeds?: any[]; components?: any[] }) => Promise<any>;
  };
}

/**
 * Mapping of Discord Gateway dispatch events to their payload types.
 */
export interface GatewayEventMap {
  ready: [client: Client];
  resumed: [];
  channelCreate: [channel: DiscordChannel];
  channelUpdate: [channel: DiscordChannel];
  channelDelete: [channel: DiscordChannel];
  guildCreate: [guild: DiscordGuild];
  guildUpdate: [guild: DiscordGuild];
  guildDelete: [data: { id: string; unavailable?: boolean }];
  guildMemberAdd: [member: DiscordMember & { guild_id: string }];
  guildMemberRemove: [data: { guild_id: string; user: DiscordUser }];
  guildMemberUpdate: [member: DiscordMember & { guild_id: string }];
  guildRoleCreate: [data: { guild_id: string; role: DiscordRole }];
  guildRoleUpdate: [data: { guild_id: string; role: DiscordRole }];
  guildRoleDelete: [data: { guild_id: string; role_id: string }];
  interactionCreate: [interaction: DiscordInteraction];
  messageCreate: [message: ClientMessage];
  messageUpdate: [message: Partial<DiscordMessage> & { id: string; channel_id: string }];
  messageDelete: [data: { id: string; channel_id: string; guild_id?: string }];
  messageDeleteBulk: [data: { ids: string[]; channel_id: string; guild_id?: string }];
  messageReactionAdd: [data: { user_id: string; channel_id: string; message_id: string; guild_id?: string; emoji: any }];
  messageReactionRemove: [data: { user_id: string; channel_id: string; message_id: string; guild_id?: string; emoji: any }];
  voiceStateUpdate: [voiceState: any];
  voiceServerUpdate: [voiceServer: { token: string; guild_id: string; endpoint: string | null }];
  typingStart: [data: { channel_id: string; guild_id?: string; user_id: string; timestamp: number }];
  userUpdate: [user: DiscordUser];
  [customEvent: string]: any[];
}

export type GatewayEventName = keyof GatewayEventMap | (string & {});

