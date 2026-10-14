import type { RouteHandler } from "./types.js";

export function defineRoute(handler: RouteHandler): RouteHandler {
  return handler;
}
