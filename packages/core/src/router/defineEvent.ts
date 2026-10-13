import type { ClientEvents } from "discord.js";
import type { EventDefinition } from "../types/index.js";

/**
 * Defines a type-safe Discord Gateway event handler.
 *
 * @example
 * ```ts
 * export default defineEvent({
 *   event: "ready",
 *   once: true,
 *   async run(client) {
 *     console.log(`Bot logged in as ${client.user.tag}`);
 *   },
 * });
 * ```
 */
export function defineEvent<K extends keyof ClientEvents | string>(
  definition: EventDefinition<K>
): EventDefinition<K> {
  return definition;
}
