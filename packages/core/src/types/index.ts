import type { ZodSchema } from "zod";
import type { ApiServerConfig, RouteHandler } from "@shardjs/api";
import type { Client, ClientOptions } from "../discord/client/Client.js";
import type {
  CommandInteraction,
  AutocompleteInteraction,
  ComponentInteraction,
  ModalInteraction,
} from "../discord/interactions/index.js";
import type { GatewayIntentBits } from "../discord/types/gateway.js";
import type { PermissionResolvable } from "../discord/types/permissions.js";
import type { GatewayEventMap } from "../discord/types/events.js";

export interface ShardContext {
  bot: Client;
  client: Client;
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
export type { Client, ClientOptions } from "../discord/client/Client.js";
