import colors from "picocolors";
import { ApiServer } from "@shardjs/api";
import { Client } from "../discord/client/Client.js";
import { normalizeIntents } from "../config/loadConfig.js";
import { FileRouter } from "../router/fileRouter.js";
import { composeMiddlewares } from "../middleware/runner.js";
import type {
  ShardConfig,
  ShardContext,
  CommandContext,
  AutocompleteContext,
  ComponentContext,
  ModalContext,
  MiddlewareHandler,
  EventDefinition,
} from "../types/index.js";
import { CommandInteraction } from "../discord/interactions/CommandInteraction.js";
import { AutocompleteInteraction } from "../discord/interactions/AutocompleteInteraction.js";
import { ComponentInteraction } from "../discord/interactions/ComponentInteraction.js";
import { ModalInteraction } from "../discord/interactions/ModalInteraction.js";

export interface ShardBotInstance {
  client: Client;
  router: FileRouter;
  apiServer?: ApiServer;
  context: ShardContext;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createBot(
  config: ShardConfig,
  rootDir: string = process.cwd()
): ShardBotInstance {
  const intentsBitmask = normalizeIntents(config.intents).reduce(
    (acc, bit) => acc | bit,
    0
  );

  const client = new Client({
    token: config.token,
    intents: intentsBitmask,
    cacheLimits: {
      guilds: 500,
      channels: 1000,
      users: 1000,
      ...config.clientOptions?.cacheLimits,
    },
    ...config.clientOptions,
  });

  // API Server if configured
  let apiServer: ApiServer | undefined;
  if (config.api) {
    apiServer = new ApiServer(config.api);
  }

  const router = new FileRouter(rootDir, apiServer?.router);

  // Dynamic context container injected into commands, events, routes
  const context: ShardContext = {
    bot: client,
    client: client,
  };

  if (apiServer) {
    apiServer.setContextProvider(() => context);
  }

  // Hook up event proxy listeners once on the client
  setupEventProxy(client, router, context);

  return {
    client,
    router,
    apiServer,
    context,

    async start() {
      // 1. Load files (commands, events, middlewares, components, modals, routes, plugins)
      await router.loadAll();

      // 2. Validate all command middleware references fail-closed (Issue #8)
      for (const cmd of router.commands.values()) {
        if (cmd.middleware) {
          for (const mwRef of cmd.middleware) {
            if (typeof mwRef === "string" && !router.middlewares.has(mwRef)) {
              throw new Error(
                `[shard] Fatal: Command "/${cmd.name}" references unresolved middleware "${mwRef}". Aborting start.`
              );
            }
          }
        }
      }

      // 3. Setup Plugins
      const allPlugins = [...(config.plugins || []), ...router.plugins];
      for (const plugin of allPlugins) {
        if (plugin.setup) {
          await plugin.setup({
            bot: client,
            config,
            inject(key: string, value: any) {
              context[key] = value;
            },
          });
        }
      }

      // 4. Start API server if configured
      if (apiServer) {
        const { port, host } = await apiServer.start();
        console.log(
          colors.green(`[shard:api] Web API running at http://${host}:${port}${config.api?.prefix || "/api"}`)
        );
      }

      // 5. Connect to Discord Gateway
      if (config.token) {
        await client.login(config.token);
      } else {
        console.warn(
          colors.yellow("[shard] No DISCORD_TOKEN provided. Gateway client skipped.")
        );
      }
    },

    async stop() {
      // Teardown plugins
      const allPlugins = [...(config.plugins || []), ...router.plugins];
      for (const plugin of allPlugins) {
        if (plugin.teardown) {
          await plugin.teardown();
        }
      }

      // Stop API
      if (apiServer) {
        await apiServer.stop();
      }

      // Destroy Discord client
      await client.destroy();
    },
  };
}

/**
 * Attaches dynamic proxy listeners to the client.
 * Dispatches to router handlers dynamically without duplicate listener leaks.
 */
function setupEventProxy(
  client: Client,
  router: FileRouter,
  context: ShardContext
): void {
  // Proxy for Interactions (Commands, Autocomplete, Components, Modals)
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction instanceof CommandInteraction) {
        await handleCommandInteraction(interaction, router, context);
      } else if (interaction instanceof AutocompleteInteraction) {
        await handleAutocompleteInteraction(interaction, router, context);
      } else if (interaction instanceof ComponentInteraction) {
        await handleComponentInteraction(interaction, router, context);
      } else if (interaction instanceof ModalInteraction) {
        await handleModalInteraction(interaction, router, context);
      }
    } catch (err: any) {
      console.error(colors.red("[shard] Interaction dispatch error:"), err);
    }
  });

  // Dynamic dispatch for all Discord Gateway events (Issue #2 & #16)
  // Use a wildcard listener to handle ANY Gateway event without hardcoding
  client.shardManager.on("dispatch", async (eventName: string, data: any) => {
    const camelEvent = toCamelCase(eventName);
    const handlers = [
      ...(router.events.get(camelEvent) || []),
      ...(router.events.get(eventName) || []),
    ];

    if (handlers.length === 0) return;

    // Filter out duplicates if any
    const uniqueHandlers = Array.from(new Set(handlers));

    for (const handler of uniqueHandlers) {
      try {
        if (camelEvent === "ready" || eventName === "READY") {
          await handler.run(client as any, data);
        } else {
          await handler.run(
            {
              ...context,
              event: camelEvent,
              args: [data],
            } as any,
            data
          );
        }

        // Support once: true (Issue #16)
        if (handler.once) {
          removeEventHandler(router, camelEvent, handler);
          removeEventHandler(router, eventName, handler);
        }
      } catch (err: any) {
        console.error(
          colors.red(`[shard] Error in event '${camelEvent}':`),
          err
        );
      }
    }
  });
}

function removeEventHandler(router: FileRouter, event: string, handler: EventDefinition): void {
  const list = router.events.get(event);
  if (list) {
    const updated = list.filter((h) => h !== handler);
    if (updated.length > 0) {
      router.events.set(event, updated);
    } else {
      router.events.delete(event);
    }
  }
}

async function handleCommandInteraction(
  interaction: CommandInteraction,
  router: FileRouter,
  context: ShardContext
): Promise<void> {
  const commandName = interaction.commandName.toLowerCase();
  const command = router.commands.get(commandName);

  if (!command) {
    await interaction.reply({
      content: `❌ Unknown command: \`/${interaction.commandName}\``,
      ephemeral: true,
    });
    return;
  }

  // Build middleware pipeline: global middlewares + command middlewares
  const pipeline: MiddlewareHandler[] = [];

  // Global middlewares from src/middleware (skip named middlewares that are referenced individually)
  for (const mw of router.middlewares.values()) {
    if (!mw.name) {
      pipeline.push(mw.run);
    }
  }

  // Command-specific middlewares (fail-closed if missing, Issue #8)
  if (command.middleware) {
    for (const mwRef of command.middleware) {
      if (typeof mwRef === "string") {
        const resolved = router.middlewares.get(mwRef);
        if (!resolved) {
          console.error(
            colors.red(`[shard] Middleware "${mwRef}" for "/${command.name}" not found – execution blocked.`)
          );
          await interaction.reply({
            content: "❌ This command is currently unavailable.",
            ephemeral: true,
          });
          return;
        }
        pipeline.push(resolved.run);
      } else if (typeof mwRef === "object" && mwRef.run) {
        pipeline.push(mwRef.run);
      }
    }
  }

  const cmdContext: CommandContext = {
    ...context,
    interaction,
    options: interaction.options,
  };

  await composeMiddlewares(pipeline, cmdContext, async (ctx) => {
    await command.run(ctx);
  });
}

async function handleAutocompleteInteraction(
  interaction: AutocompleteInteraction,
  router: FileRouter,
  context: ShardContext
): Promise<void> {
  const commandName = interaction.commandName.toLowerCase();
  const command = router.commands.get(commandName);

  if (command?.autocomplete) {
    const autoContext: AutocompleteContext = {
      ...context,
      interaction,
    };
    await command.autocomplete(autoContext);
  }
}

async function handleComponentInteraction(
  interaction: ComponentInteraction,
  router: FileRouter,
  context: ShardContext
): Promise<void> {
  const customId = interaction.customId;

  for (const [key, compDef] of router.components.entries()) {
    const match =
      compDef.customId instanceof RegExp
        ? compDef.customId.test(customId)
        : key === customId;

    if (match) {
      const compContext: ComponentContext = {
        ...context,
        interaction,
      };
      await compDef.run(compContext);
      return;
    }
  }
}

async function handleModalInteraction(
  interaction: ModalInteraction,
  router: FileRouter,
  context: ShardContext
): Promise<void> {
  const customId = interaction.customId;

  for (const [key, modalDef] of router.modals.entries()) {
    const match =
      modalDef.customId instanceof RegExp
        ? modalDef.customId.test(customId)
        : key === customId;

    if (match) {
      const modalContext: ModalContext = {
        ...context,
        interaction,
      };
      await modalDef.run(modalContext);
      return;
    }
  }
}

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}
