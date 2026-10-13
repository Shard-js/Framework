import type { RouteHandler } from "./types.js";

/**
 * Defines a type-safe HTTP route handler for shard web API.
 * Similar to Next.js App Router route handlers.
 *
 * @example
 * ```ts
 * export const GET = defineRoute(async ({ request, params, bot }) => {
 *   return Response.json({ status: "ok" });
 * });
 * ```
 */
export function defineRoute(handler: RouteHandler): RouteHandler {
  return handler;
}
