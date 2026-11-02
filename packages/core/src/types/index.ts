import type { ZodSchema } from "zod";
import type { ApiServerConfig, RouteHandler } from "@shardjs-framework/api";
import type { Client, ClientOptions } from "../discord/client/Client.js";
import type {
  CommandInteraction,
  AutocompleteInteraction,
  ComponentInteraction,
  ModalInteraction,
} from "../discord/interactions/index.js";
import type { ApplicationCommandType } from "../discord/types/interactions.js";
import type { GatewayIntentBits } from "../discord/types/gateway.js";
import type { PermissionResolvable } from "../discord/types/permissions.js";
import type { GatewayEventMap } from "../discord/types/events.js";
import type { Logger, LogLevel, LogFormat, LogEntry } from "../logging/index.js";
import type { MetricsCollector, MetricsSnapshot } from "../metrics/index.js";

export interface ShardContext {
  bot: Client;
  client: Client;
  logger: Logger;
  metrics: MetricsCollector;
  [key: string]: any;
}

export interface CommandContext<TOptions = any> extends ShardContext {
  interaction: CommandInteraction;
  options: CommandInteraction["options"];
  parsedOptions?: TOptions;
}

export interface AutocompleteContext extends ShardContext {
  interaction: AutocompleteInteraction;
}

export interface ComponentContext extends ShardContext {
  interaction: ComponentInteraction;
}

export interface ModalContext extends ShardContext {
  interaction: ModalInteraction;
}

export type CommandOptionType =
  | "Subcommand"
  | "SubcommandGroup"
  | "String"
  | "Integer"
  | "Number"
  | "Boolean"
  | "User"
  | "Channel"
  | "Role"
  | "Mentionable"
  | "Attachment";

export interface CommandOptionChoice<T = string | number> {
  name: string;
  value: T;
}

export interface CommandOptionDefinition {
  name: string;
  description: string;
  type: CommandOptionType;
  required?: boolean;
  choices?: CommandOptionChoice[];
  autocomplete?: boolean;
  options?: readonly CommandOptionDefinition[] | CommandOptionDefinition[];
  minValue?: number;
  min_value?: number;
  maxValue?: number;
  max_value?: number;
  minLength?: number;
  min_length?: number;
  maxLength?: number;
  max_length?: number;
  channelTypes?: number[];
  channel_types?: number[];
  nameLocalizations?: Record<string, string>;
  name_localizations?: Record<string, string>;
  descriptionLocalizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
}

export interface CommandDefinition<TOptions = any> {
  name: string;
  description?: string;
  type?: ApplicationCommandType | "ChatInput" | "User" | "Message" | number;
  options?: readonly CommandOptionDefinition[] | CommandOptionDefinition[];
  guildOnly?: boolean;
  defaultMemberPermissions?: PermissionResolvable;
  dmPermission?: boolean;
  nsfw?: boolean;
  nameLocalizations?: Record<string, string>;
  name_localizations?: Record<string, string>;
  descriptionLocalizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
  middleware?: (string | MiddlewareDefinition)[];
  cooldown?: number;
  cooldownScope?: "user" | "guild" | "channel";
  onCooldown?: (ctx: CommandContext<TOptions>, remainingSeconds: number) => Promise<any> | any;
  run: (ctx: CommandContext<TOptions>) => Promise<any> | any;
  autocomplete?: (ctx: AutocompleteContext) => Promise<any> | any;
  filePath?: string;
  subcommands?: Map<string, CommandDefinition>;
}

export interface ComponentDefinition {
  customId: string | RegExp;
  run: (ctx: ComponentContext) => Promise<any> | any;
  filePath?: string;
}

export interface ModalDefinition {
  customId: string | RegExp;
  run: (ctx: ModalContext) => Promise<any> | any;
  filePath?: string;
}

export interface EventContext extends ShardContext {
  event: string;
  args: any[];
}

export interface EventDefinition<K extends keyof GatewayEventMap | string = string> {
  event: K;
  once?: boolean;
  run: (
    ctx: K extends "ready" ? Client : EventContext,
    ...args: K extends keyof GatewayEventMap ? GatewayEventMap[K] : any[]
  ) => Promise<any> | any;
  filePath?: string;
}

export type MiddlewareHandler<T = any> = (
  ctx: T,
  next: () => Promise<void>
) => Promise<void> | void;

export interface MiddlewareDefinition<T = any> {
  name?: string;
  run: MiddlewareHandler<T>;
  filePath?: string;
}

export interface PluginContext {
  bot: Client;
  config: ShardConfig;
  inject: (key: string, value: any) => void;
}

export interface ShardPlugin {
  name: string;
  setup?: (ctx: PluginContext) => Promise<void> | void;
  teardown?: () => Promise<void> | void;
  cli?: (cmd: any) => void;
}

export interface HealthCheckConfig {
  path?: string;
  customCheck?: () => Promise<Record<string, any>> | Record<string, any>;
}

export interface ShardConfig {
  token?: string;
  publicKey?: string;
  interactionsPublicKey?: string;
  intents?: (GatewayIntentBits | number | keyof typeof GatewayIntentBits)[];
  devGuildId?: string;
  api?: ApiServerConfig;
  env?: ZodSchema<any>;
  plugins?: ShardPlugin[];
  clientOptions?: Partial<ClientOptions>;
  logging?: {
    level?: LogLevel;
    format?: LogFormat;
    destination?: (entry: LogEntry, formatted: string) => void;
  };
  metrics?: boolean | { enabled?: boolean; collectMemory?: boolean };
  healthCheck?: boolean | string | HealthCheckConfig;
  onCommandError?: (error: Error, ctx: CommandContext) => Promise<any> | any;
}

export type { RouteHandler } from "@shardjs-framework/api";
export type { Client, ClientOptions } from "../discord/client/Client.js";
export type { Logger, LogLevel, LogFormat, LogEntry, LoggerOptions } from "../logging/index.js";
export type { MetricsCollector, MetricsSnapshot, MetricsCollectorOptions } from "../metrics/index.js";
