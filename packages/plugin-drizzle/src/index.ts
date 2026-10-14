import { spawn } from "node:child_process";
import colors from "picocolors";
import type { ShardPlugin } from "@shardjs/core";

declare module "@shardjs/core" {
  interface ShardContext {
    db?: any;
  }
}

export interface DrizzlePluginOptions {
  client?: any;
  schema?: any;
  connectionString?: string;
  configPath?: string;
}

export function executeDrizzleKit(action: "migrate" | "push", configPath?: string): Promise<number> {
  if (configPath && !/^[a-zA-Z0-9_./\\-]+$/.test(configPath)) {
    throw new Error(`[drizzle] Invalid config path containing illegal characters: "${configPath}"`);
  }

  return new Promise((resolve) => {
    const args = ["exec", "drizzle-kit", action];
    if (configPath) {
      args.push("--config", configPath);
    }

    const proc = spawn("npx", args, {
      stdio: "inherit",
      cwd: process.cwd(),
      shell: process.platform === "win32",
    });

    proc.on("error", (err) => {
      console.error(colors.red(`[drizzle] Failed to execute drizzle-kit ${action}: ${err.message}`));
      console.error(colors.yellow("[drizzle] Ensure 'drizzle-kit' is installed: pnpm add -D drizzle-kit"));
      resolve(1);
    });

    proc.on("exit", (code) => {
      resolve(code ?? 0);
    });
  });
}

export function drizzlePlugin(options: DrizzlePluginOptions = {}): ShardPlugin {
  return {
    name: "drizzle",

    cli(cmd) {
      cmd
        .command("db:migrate", "Run Drizzle migrations via drizzle-kit")
        .option("-c, --config <path>", "Path to drizzle.config.ts")
        .action(async (cliOptions: { config?: string }) => {
          console.log(colors.cyan("[drizzle] Running database migrations via drizzle-kit..."));
          const config = cliOptions?.config || options.configPath;
          const exitCode = await executeDrizzleKit("migrate", config);
          if (exitCode === 0) {
            console.log(colors.green("[drizzle] Migrations completed successfully."));
          } else {
            console.error(colors.red(`[drizzle] Migrations failed with exit code ${exitCode}.`));
            process.exit(exitCode);
          }
        });

      cmd
        .command("db:push", "Push Drizzle schema directly to database via drizzle-kit")
        .option("-c, --config <path>", "Path to drizzle.config.ts")
        .action(async (cliOptions: { config?: string }) => {
          console.log(colors.cyan("[drizzle] Pushing schema to database via drizzle-kit..."));
          const config = cliOptions?.config || options.configPath;
          const exitCode = await executeDrizzleKit("push", config);
          if (exitCode === 0) {
            console.log(colors.green("[drizzle] Schema synced successfully."));
          } else {
            console.error(colors.red(`[drizzle] Schema push failed with exit code ${exitCode}.`));
            process.exit(exitCode);
          }
        });
    },

    async setup({ inject }) {
      if (options.client) {
        inject("db", options.client);
        console.log(colors.green("[shard:plugin-drizzle] Drizzle ORM client injected into ctx.db."));
      } else {
        console.warn(
          colors.yellow(
            "[shard:plugin-drizzle] Warning: No Drizzle database client was provided to drizzlePlugin({ client }). 'ctx.db' will remain undefined."
          )
        );
      }
    },

    async teardown() {
      if (options.client) {
        if (typeof options.client.end === "function") {
          await options.client.end();
        } else if (typeof options.client.$client?.end === "function") {
          await options.client.$client.end();
        } else if (typeof options.client.destroy === "function") {
          await options.client.destroy();
        }
      }
    },
  };
}
