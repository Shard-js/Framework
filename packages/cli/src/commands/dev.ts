import path from "node:path";
import chokidar from "chokidar";
import colors from "picocolors";
import { loadConfig, createBot } from "@shardjs/core";

export interface DevCommandOptions {
  port?: number;
  clearCommands?: boolean;
}

export async function runDev(options: DevCommandOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  console.log(colors.cyan(colors.bold("\n💎 shard dev (v0.2.0) - Starting development server...\n")));

  const { config, configPath } = await loadConfig(rootDir);

  if (options.port && config.api) {
    config.api.port = options.port;
  }

  const bot = createBot(config, rootDir);

  try {
    await bot.start();
    console.log(colors.green("✨ [shard] Bot engine and routers loaded successfully."));
    if (bot.client.user) {
      console.log(colors.green(`🤖 Logged in as: ${bot.client.user.tag}`));
    }
  } catch (err: any) {
    console.error(colors.red("[shard] Failed to start bot:"), err.message);
  }

  const watchPath = path.join(rootDir, "src");
  const watcher = chokidar.watch(watchPath, {
    ignoreInitial: true,
    persistent: true,
  });

  console.log(colors.gray(`👀 Watching for file changes in ./src...`));

  watcher.on("change", async (filePath) => {
    const relPath = path.relative(rootDir, filePath);
    const start = performance.now();
    try {
      const category = await bot.router.reloadFile(filePath);
      const elapsed = (performance.now() - start).toFixed(1);

      if (category) {
        console.log(
          colors.blue(
            `⚡ [shard:hmr] Reloaded ${category} (${relPath}) in ${elapsed}ms (Gateway WebSocket kept alive)`
          )
        );
      }
    } catch (err: any) {
      console.error(
        colors.red(`❌ [shard:hmr] Error reloading ${relPath}:`),
        err.message
      );
    }
  });

  let configWatcher: ReturnType<typeof chokidar.watch> | null = null;
  if (configPath) {
    configWatcher = chokidar.watch(configPath, { ignoreInitial: true });
    configWatcher.on("change", () => {
      console.log(
        colors.yellow("\n⚠️ [shard] Config file changed. Please restart 'shard dev' to apply root config changes.")
      );
    });
  }

  const shutdown = async () => {
    console.log(colors.yellow("\n🛑 Stopping shard dev server..."));
    if (watcher) await watcher.close();
    if (configWatcher) await configWatcher.close();
    await bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
