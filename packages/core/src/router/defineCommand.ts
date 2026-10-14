import type { CommandDefinition } from "../types/index.js";

export function defineCommand<TOptions = any>(
  definition: CommandDefinition<TOptions>
): CommandDefinition<TOptions> {
  return definition;
}
