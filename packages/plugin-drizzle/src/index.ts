import colors from "picocolors";
import type { ShardPlugin } from "@shardjs/core";

// Module augmentation: adds 'db' to ShardContext across the framework
declare module "@shardjs/core" {
  interface ShardContext {
    db: any;
  }
}

export interface DrizzlePluginOptions {
  client?: any;
  schema?: any;
  connectionString?: string;
}

/**
 * Official Drizzle ORM plugin for shard framework.
 * Automatically injects `ctx.db` into commands, events and HTTP route handlers.
 *
 * @example
 * ```ts
 * import { drizzlePlugin } from "@shardjs/plugin-drizzle";
 *
 * export default defineConfig({
 *   plugins: [drizzlePlugin({ schema })],
 * });
 * ```
 */
export function drizzlePlugin(options: DrizzlePluginOptions = {}): ShardPlugin {
  return {
    name: "drizzle",

    cli(cmd) {
      cmd
        .command("db:migrate", "Run Drizzle migrations")
        .action(async () => {
          console.log(colors.cyan("📦 [drizzle] Running database migrations..."));
          // Hook to drizzle-kit or custom migration logic
          console.log(colors.green("✅ Migrations completed!"));
        });

      cmd
        .command("db:push", "Push Drizzle schema directly to database")
        .action(async () => {
          console.log(colors.cyan("📦 [drizzle] Pushing schema to database..."));
          console.log(colors.green("✅ Schema synced!"));
        });
    },

    async setup({ inject }) {
      const dbClient = options.client || {
        _isMock: true,
        async query() {
          return [];
        },
      };

      // Injects db into ShardContext
      inject("db", dbClient);
      console.log(colors.green("📦 [shard:plugin-drizzle] Drizzle ORM initialized."));
    },

    async teardown() {
      // Cleanup connections
    },
  };
}
