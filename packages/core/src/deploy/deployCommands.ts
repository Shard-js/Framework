import { REST } from "@discordjs/rest";
import { SlashCommandBuilder } from "@discordjs/builders";
import { PermissionsBitField } from "discord.js";
import {
  Routes,
  ApplicationCommandOptionType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import colors from "picocolors";
import type {
  CommandDefinition,
  CommandOptionDefinition,
  ShardConfig,
} from "../types/index.js";

/**
 * Transforms a CommandDefinition to Discord REST API JSON format
 */
export function commandToDiscordJson(
  cmd: CommandDefinition
): RESTPostAPIApplicationCommandsJSONBody {
  const builder = new SlashCommandBuilder()
    .setName(cmd.name)
    .setDescription(cmd.description);

  if (cmd.guildOnly !== undefined) {
    builder.setDMPermission(!cmd.guildOnly);
  }
  if (cmd.dmPermission !== undefined) {
    builder.setDMPermission(cmd.dmPermission);
  }
  if (cmd.defaultMemberPermissions !== undefined) {
    builder.setDefaultMemberPermissions(
      PermissionsBitField.resolve(cmd.defaultMemberPermissions)
    );
  }

  if (cmd.options) {
    for (const opt of cmd.options) {
      addOptionToBuilder(builder, opt);
    }
  }

  return builder.toJSON() as any;
}

function addOptionToBuilder(
  builder: SlashCommandBuilder,
  opt: CommandOptionDefinition
): void {
  switch (opt.type) {
    case "String":
      builder.addStringOption((o) => {
        o.setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required));
        if (opt.autocomplete) o.setAutocomplete(true);
        if (opt.choices) {
          for (const c of opt.choices) {
            o.addChoices({ name: c.name, value: String(c.value) });
          }
        }
        return o;
      });
      break;
    case "Integer":
      builder.addIntegerOption((o) => {
        o.setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required));
        if (opt.autocomplete) o.setAutocomplete(true);
        if (opt.choices) {
          for (const c of opt.choices) {
            o.addChoices({ name: c.name, value: Number(c.value) });
          }
        }
        return o;
      });
      break;
    case "Number":
      builder.addNumberOption((o) => {
        o.setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required));
        if (opt.autocomplete) o.setAutocomplete(true);
        return o;
      });
      break;
    case "Boolean":
      builder.addBooleanOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
    case "User":
      builder.addUserOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
    case "Channel":
      builder.addChannelOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
    case "Role":
      builder.addRoleOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
    case "Mentionable":
      builder.addMentionableOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
    case "Attachment":
      builder.addAttachmentOption((o) =>
        o
          .setName(opt.name)
          .setDescription(opt.description)
          .setRequired(Boolean(opt.required))
      );
      break;
  }
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

  const rest = new REST({ version: "10" }).setToken(token);

  // Retrieve Bot Client ID from Discord REST /users/@me
  const currentUser: any = await rest.get(Routes.user("@me"));
  const clientId = currentUser.id;

  const payload = options.clean
    ? []
    : commands.map((c) => commandToDiscordJson(c));

  const targetGuild = options.guildId || config.devGuildId;

  if (targetGuild && !options.global) {
    console.log(
      colors.cyan(`🚀 Deploying ${payload.length} commands to Guild ID: ${targetGuild}...`)
    );
    await rest.put(Routes.applicationGuildCommands(clientId, targetGuild), {
      body: payload,
    });
    return { count: payload.length, target: `Guild (${targetGuild})` };
  } else {
    console.log(
      colors.cyan(`🌍 Deploying ${payload.length} commands globally...`)
    );
    await rest.put(Routes.applicationCommands(clientId), {
      body: payload,
    });
    return { count: payload.length, target: "Global" };
  }
}
