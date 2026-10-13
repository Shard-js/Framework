import type { ShardConfig } from "../types/index.js";

/**
 * Type-safe configuration helper for shard Discord bot applications.
 *
 * @example
 * ```ts
 * import { defineConfig } from "@shardjs/core";
 *
 * export default defineConfig({
 *   intents: ["Guilds", "GuildMessages"],
 *   api: { port: 3000 },
 * });
 * ```
 */
export function defineConfig(config: ShardConfig): ShardConfig {
  return config;
}
