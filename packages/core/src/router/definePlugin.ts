import type { ShardPlugin } from "../types/index.js";

/**
 * Defines a reusable plugin for the shard Discord framework.
 *
 * @example
 * ```ts
 * export default definePlugin({
 *   name: "my-plugin",
 *   setup({ bot, inject }) {
 *     inject("customService", new CustomService());
 *   },
 * });
 * ```
 */
export function definePlugin(plugin: ShardPlugin): ShardPlugin {
  return plugin;
}
