import type { CommandDefinition, CommandContext } from "../types/index.js";

export interface CommandDefinitionWithData<TOptions = any>
  extends Omit<Partial<CommandDefinition<TOptions>>, "run"> {
  data?: { toJSON: () => any } | Partial<CommandDefinition<TOptions>>;
  run: (ctx: CommandContext<TOptions>) => Promise<any> | any;
}

export function defineCommand<TOptions = any>(
  definition: CommandDefinition<TOptions> | CommandDefinitionWithData<TOptions>
): CommandDefinition<TOptions> {
  if ("data" in definition && definition.data) {
    const rawData =
      typeof (definition.data as any).toJSON === "function"
        ? (definition.data as any).toJSON()
        : definition.data;
    const { data, ...rest } = definition;
    return {
      ...rawData,
      ...rest,
    } as CommandDefinition<TOptions>;
  }
  return definition as CommandDefinition<TOptions>;
}
