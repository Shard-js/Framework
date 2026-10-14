import type { GatewayEventMap } from "../discord/types/events.js";
import type { EventDefinition } from "../types/index.js";

export function defineEvent<K extends keyof GatewayEventMap | string>(
  definition: EventDefinition<K>
): EventDefinition<K> {
  return definition;
}
