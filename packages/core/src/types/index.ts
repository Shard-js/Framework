import type {
  Client,
  ClientOptions,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  GatewayIntentBits,
  CommandInteractionOptionResolver,
  PermissionResolvable,
} from "discord.js";
import type { ZodSchema } from "zod";
import type { ApiServerConfig, RouteHandler } from "@shardjs/api";

/**
 * Global Shard context interface, open for module augmentation by plugins.
 *
 * @example
 * ```ts
 * declare module "@shardjs/core" {
 *   interface ShardContext {
 *     db: MyDatabase;
 *   }
 * }
 * ```
 */
export interface ShardContext {
  bot: Client;
  client: Client;
  [key: string]: any;
}

/**
 * Context passed to command run handlers
 */
export interface CommandContext<TOptions = any> extends ShardContext {
  interaction: ChatInputCommandInteraction;
  options: ChatInputCommandInteraction["options"];
  parsedOptions?: TOptions;
}

/**
 * Context passed to command autocomplete handlers
 */
export interface AutocompleteContext extends ShardContext {
  interaction: AutocompleteInteraction;
}

export type CommandOptionType =
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
}

export interface CommandDefinition<TOptions = any> {
  name: string;
  description: string;
  options?: readonly CommandOptionDefinition[] | CommandOptionDefinition[];
  guildOnly?: boolean;
  defaultMemberPermissions?: PermissionResolvable;
  dmPermission?: boolean;
  middleware?: (string | MiddlewareDefinition)[];
  run: (ctx: CommandContext<TOptions>) => Promise<any> | any;
  autocomplete?: (ctx: AutocompleteContext) => Promise<any> | any;
  filePath?: string;
}

export interface EventContext extends ShardContext {
  event: string;
  args: any[];
}

export interface EventDefinition<K = string> {
  event: K;
  once?: boolean;
  run: (...args: any[]) => Promise<any> | any;
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

export interface ShardConfig {
  token?: string;
  intents?: (GatewayIntentBits | number | keyof typeof GatewayIntentBits)[];
  devGuildId?: string;
  api?: ApiServerConfig;
  env?: ZodSchema<any>;
  plugins?: ShardPlugin[];
  clientOptions?: Partial<ClientOptions>;
}

export type { RouteHandler } from "@shardjs/api";
