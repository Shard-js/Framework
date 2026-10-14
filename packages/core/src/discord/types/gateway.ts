import type { DiscordUser } from "./entities.js";

export enum GatewayOpcodes {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11,
}

export enum GatewayCloseCodes {
  UnknownError = 4000,
  UnknownOpcode = 4001,
  DecodeError = 4002,
  NotAuthenticated = 4003,
  AuthenticationFailed = 4004,
  AlreadyAuthenticated = 4005,
  InvalidSeq = 4007,
  RateLimited = 4008,
  SessionTimedOut = 4009,
  InvalidShard = 4010,
  ShardingRequired = 4011,
  InvalidApiVersion = 4012,
  InvalidIntents = 4013,
  DisallowedIntents = 4014,
}

export function isRecoverableCloseCode(code: number): boolean {
  switch (code) {
    case GatewayCloseCodes.AuthenticationFailed:
    case GatewayCloseCodes.InvalidShard:
    case GatewayCloseCodes.ShardingRequired:
    case GatewayCloseCodes.InvalidApiVersion:
    case GatewayCloseCodes.InvalidIntents:
    case GatewayCloseCodes.DisallowedIntents:
      return false;
    default:
      return true;
  }
}

export const GatewayIntentBits = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1,
  GuildModeration: 1 << 2,
  GuildEmojisAndStickers: 1 << 3,
  GuildIntegrations: 1 << 4,
  GuildWebhooks: 1 << 5,
  GuildInvites: 1 << 6,
  GuildVoiceStates: 1 << 7,
  GuildPresences: 1 << 8,
  GuildMessages: 1 << 9,
  GuildMessageReactions: 1 << 10,
  GuildMessageTyping: 1 << 11,
  DirectMessages: 1 << 12,
  DirectMessageReactions: 1 << 13,
  DirectMessageTyping: 1 << 14,
  MessageContent: 1 << 15,
  GuildScheduledEvents: 1 << 16,
  AutoModerationConfiguration: 1 << 20,
  AutoModerationExecution: 1 << 21,
} as const;

export type GatewayIntentBits = (typeof GatewayIntentBits)[keyof typeof GatewayIntentBits];

export interface GatewayPayload<T = any> {
  op: GatewayOpcodes;
  d: T;
  s?: number | null;
  t?: string | null;
}

export interface GatewayHelloData {
  heartbeat_interval: number;
}

export interface GatewayReadyData {
  v: number;
  user: DiscordUser;
  guilds: Array<{ id: string; unavailable?: boolean }>;
  session_id: string;
  resume_gateway_url: string;
  shard?: [number, number];
  application: { id: string; flags: number };
}

export interface GatewayIdentifyData {
  token: string;
  properties: {
    os: string;
    browser: string;
    device: string;
  };
  compress?: boolean;
  large_threshold?: number;
  shard?: [number, number];
  presence?: any;
  intents: number;
}

export interface GatewayResumeData {
  token: string;
  session_id: string;
  seq: number;
}
