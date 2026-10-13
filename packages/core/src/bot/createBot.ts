import {
  Client,
  Options,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
} from "discord.js";
import colors from "picocolors";
import { ApiServer } from "@shardjs/api";
import { normalizeIntents } from "../config/loadConfig.js";
import { FileRouter } from "../router/fileRouter.js";
import { composeMiddlewares } from "../middleware/runner.js";
import type {
  ShardConfig,
  ShardContext,
  CommandContext,
  AutocompleteContext,
  MiddlewareHandler,
} from "../types/index.js";

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
  // Safe default cache limits (Sweepers) to prevent memory leaks
  const clientOptions = {
    intents: normalizeIntents(config.intents),
    makeCache: Options.cacheWithLimits({
      MessageManager: 50,
      PresenceManager: 0,
      UserManager: 100,
      GuildMemberManager: 200,
      ReactionManager: 0,
      StageInstanceManager: 0,
      VoiceStateManager: 50,
      ...config.clientOptions?.makeCache,
    }),
    ...config.clientOptions,
  };

  const client = new Client(clientOptions);

  // Api Server if enabled
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

  // Return lifecycle controller
  return {
    client,
    router,
    apiServer,
    context,

    async start() {
      // 1. Load files (commands, events, middlewares, routes, plugins)
      await router.loadAll();

      // 2. Setup Plugins
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

      // 3. Start API server if configured
      if (apiServer) {
        const { port, host } = await apiServer.start();
        console.log(
          colors.green(`🌐 [shard:api] Web API running at http://${host}:${port}${config.api?.prefix || "/api"}`)
        );
      }

      // 4. Log in to Discord Gateway
      if (config.token) {
        await client.login(config.token);
      } else {
        console.warn(
          colors.yellow("⚠️ [shard] No DISCORD_TOKEN provided. Gateway client skipped.")
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
 * Attaches a single stable proxy listener per Discord event.
 * Dispatches to router.events dynamically without duplicate listener leaks.
 */
function setupEventProxy(
  client: Client,
  router: FileRouter,
  context: ShardContext
): void {
  // Proxy for Slash Commands and Autocomplete
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommandInteraction(interaction, router, context);
      } else if (interaction.isAutocomplete()) {
        await handleAutocompleteInteraction(interaction, router, context);
      }
    } catch (err: any) {
      console.error(colors.red("[shard] Interaction error:"), err);
    }
  });

  // Dynamic dispatch for all standard gateway events
  const standardEvents = [
    "ready",
    "messageCreate",
    "messageDelete",
    "messageUpdate",
    "guildMemberAdd",
    "guildMemberRemove",
    "guildMemberUpdate",
    "guildCreate",
    "guildDelete",
    "channelCreate",
    "channelDelete",
    "channelUpdate",
    "roleCreate",
    "roleDelete",
    "roleUpdate",
    "voiceStateUpdate",
  ];

  for (const eventName of standardEvents) {
    client.on(eventName as any, async (...args: any[]) => {
      const handlers = router.events.get(eventName);
      if (!handlers || handlers.length === 0) return;

      for (const handler of handlers) {
        try {
          if (eventName === "ready") {
            // ready handler gets client directly or context
            await handler.run(client, ...args);
          } else {
            await handler.run(
              {
                ...context,
                event: eventName,
                args,
              },
              ...args
            );
          }
        } catch (err: any) {
          console.error(
            colors.red(`[shard] Error in event '${eventName}':`),
            err
          );
        }
      }
    });
  }
}

async function handleCommandInteraction(
  interaction: ChatInputCommandInteraction,
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

  // Global middlewares from src/middleware
  for (const mw of router.middlewares.values()) {
    pipeline.push(mw.run);
  }

  // Command-specific middlewares
  if (command.middleware) {
    for (const mwRef of command.middleware) {
      if (typeof mwRef === "string") {
        const resolved = router.middlewares.get(mwRef);
        if (resolved) pipeline.push(resolved.run);
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
