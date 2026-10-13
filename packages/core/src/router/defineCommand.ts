import type { CommandDefinition } from "../types/index.js";

/**
 * Defines a type-safe Discord Slash Command or Context Menu command.
 *
 * @example
 * ```ts
 * export default defineCommand({
 *   name: "ping",
 *   description: "Zeigt die Latenz des Bots an",
 *   async run({ interaction, bot }) {
 *     await interaction.reply(`Pong! ${bot.ws.ping}ms`);
 *   },
 * });
 * ```
 */
export function defineCommand<TOptions = any>(
  definition: CommandDefinition<TOptions>
): CommandDefinition<TOptions> {
  return definition;
}
