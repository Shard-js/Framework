import colors from "picocolors";
import { RestClient } from "../discord/rest/RestClient.js";
import { Endpoints } from "../discord/rest/Endpoints.js";
import { PermissionsBitField } from "../discord/types/permissions.js";
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
} from "../discord/types/interactions.js";
import type {
  CommandDefinition,
  CommandOptionDefinition,
  CommandOptionType,
  ShardConfig,
} from "../types/index.js";

const OPTION_TYPE_MAP: Record<CommandOptionType, number> = {
  Subcommand: ApplicationCommandOptionType.Subcommand,
  SubcommandGroup: ApplicationCommandOptionType.SubcommandGroup,
  String: ApplicationCommandOptionType.String,
  Integer: ApplicationCommandOptionType.Integer,
  Number: ApplicationCommandOptionType.Number,
  Boolean: ApplicationCommandOptionType.Boolean,
  User: ApplicationCommandOptionType.User,
  Channel: ApplicationCommandOptionType.Channel,
  Role: ApplicationCommandOptionType.Role,
  Mentionable: ApplicationCommandOptionType.Mentionable,
  Attachment: ApplicationCommandOptionType.Attachment,
};

export function resolveCommandType(
  type?: ApplicationCommandType | "ChatInput" | "User" | "Message" | number
): ApplicationCommandType {
  if (type === undefined) return ApplicationCommandType.ChatInput;
  if (typeof type === "number") return type as ApplicationCommandType;
  if (type === "User") return ApplicationCommandType.User;
  if (type === "Message") return ApplicationCommandType.Message;
  return ApplicationCommandType.ChatInput;
}

export function commandToDiscordJson(cmd: CommandDefinition): any {
  const cmdType = resolveCommandType(cmd.type);
  const json: any = {
    name: cmd.name,
  };

  if (cmdType !== ApplicationCommandType.ChatInput) {
    json.type = cmdType;
  } else {
    json.description = cmd.description || "";
  }

  const nameLocs = cmd.nameLocalizations || cmd.name_localizations;
  if (nameLocs) json.name_localizations = nameLocs;

  const descLocs = cmd.descriptionLocalizations || cmd.description_localizations;
  if (descLocs && cmdType === ApplicationCommandType.ChatInput) {
    json.description_localizations = descLocs;
  }

  if (cmd.nsfw !== undefined) {
    json.nsfw = Boolean(cmd.nsfw);
  }

  if (cmd.guildOnly !== undefined) {
    json.dm_permission = !cmd.guildOnly;
  }
  if (cmd.dmPermission !== undefined) {
    json.dm_permission = cmd.dmPermission;
  }
  if (cmd.defaultMemberPermissions !== undefined) {
    json.default_member_permissions = PermissionsBitField.resolve(
      cmd.defaultMemberPermissions
    ).toString();
  }

  if (cmdType === ApplicationCommandType.ChatInput && cmd.options && cmd.options.length > 0) {
    json.options = cmd.options.map((opt) => transformOption(opt));
  }

  return json;
}

function transformOption(opt: CommandOptionDefinition): any {
  const typeInt = OPTION_TYPE_MAP[opt.type] ?? ApplicationCommandOptionType.String;
  const json: any = {
    type: typeInt,
    name: opt.name,
    description: opt.description,
  };

  const nameLocs = opt.nameLocalizations ?? opt.name_localizations;
  if (nameLocs) json.name_localizations = nameLocs;

  const descLocs = opt.descriptionLocalizations ?? opt.description_localizations;
  if (descLocs) json.description_localizations = descLocs;

  if (
    opt.type !== "Subcommand" &&
    opt.type !== "SubcommandGroup"
  ) {
    if (opt.required !== undefined) json.required = Boolean(opt.required);
    if (opt.autocomplete !== undefined) json.autocomplete = Boolean(opt.autocomplete);
    if (opt.choices && opt.choices.length > 0) {
      json.choices = opt.choices.map((c) => ({
        name: c.name,
        value: c.value,
      }));
    }

    const minValue = opt.minValue ?? opt.min_value;
    if (minValue !== undefined) json.min_value = minValue;

    const maxValue = opt.maxValue ?? opt.max_value;
    if (maxValue !== undefined) json.max_value = maxValue;

    const minLength = opt.minLength ?? opt.min_length;
    if (minLength !== undefined) json.min_length = minLength;

    const maxLength = opt.maxLength ?? opt.max_length;
    if (maxLength !== undefined) json.max_length = maxLength;

    const channelTypes = opt.channelTypes ?? opt.channel_types;
    if (channelTypes && Array.isArray(channelTypes)) {
      json.channel_types = channelTypes;
    }
  }

  if (opt.options && opt.options.length > 0) {
    json.options = opt.options.map((subOpt) => transformOption(subOpt));
  }

  return json;
}

export interface DeployOptions {
  guildId?: string;
  global?: boolean;
  clean?: boolean;
}

export async function deployCommands(
  commands: CommandDefinition[],
  config: ShardConfig,
  options: DeployOptions = {}
): Promise<{ count: number; target: string }> {
  const token = config.token || process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("No DISCORD_TOKEN provided for deploying commands.");
  }

  const rest = new RestClient({ token });

  const currentUser: any = await rest.get(Endpoints.userMe());
  const clientId = currentUser.id;

  const payload = options.clean
    ? []
    : commands.map((c) => commandToDiscordJson(c));

  const targetGuild = options.guildId || config.devGuildId;

  if (targetGuild && !options.global) {
    console.log(
      colors.cyan(`🚀 Deploying ${payload.length} commands to Guild ID: ${targetGuild}...`)
    );
    await rest.put(Endpoints.applicationGuildCommands(clientId, targetGuild), {
      body: payload,
    });
    return { count: payload.length, target: `Guild (${targetGuild})` };
  } else {
    console.log(
      colors.cyan(`🌍 Deploying ${payload.length} commands globally...`)
    );
    await rest.put(Endpoints.applicationCommands(clientId), {
      body: payload,
    });
    return { count: payload.length, target: "Global" };
  }
}
