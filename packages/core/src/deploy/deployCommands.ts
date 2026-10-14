import colors from "picocolors";
import { RestClient } from "../discord/rest/RestClient.js";
import { Endpoints } from "../discord/rest/Endpoints.js";
import { PermissionsBitField } from "../discord/types/permissions.js";
import { ApplicationCommandOptionType } from "../discord/types/interactions.js";
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

/**
 * Transforms a CommandDefinition to Discord REST API JSON format (API v10)
 * Supports Subcommands and SubcommandGroups recursively.
 */
export function commandToDiscordJson(cmd: CommandDefinition): any {
  const json: any = {
    name: cmd.name,
    description: cmd.description,
  };

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

  if (cmd.options && cmd.options.length > 0) {
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

  // Subcommands/SubcommandGroups do not have required/autocomplete
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
  }

  // Recursive options for Subcommands and SubcommandGroups (Issue #2)
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

  // Retrieve Bot Client ID from Discord REST /users/@me
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
