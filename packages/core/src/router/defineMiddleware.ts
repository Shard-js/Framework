import type {
  MiddlewareDefinition,
  MiddlewareHandler,
} from "../types/index.js";

/**
 * Defines a middleware for commands, events, or route handlers.
 *
 * @example
 * ```ts
 * export default defineMiddleware(async (ctx, next) => {
 *   const start = Date.now();
 *   await next();
 *   console.log(`Executed in ${Date.now() - start}ms`);
 * });
 * ```
 */
export function defineMiddleware<T = any>(
  defOrHandler: MiddlewareDefinition<T> | MiddlewareHandler<T>
): MiddlewareDefinition<T> {
  if (typeof defOrHandler === "function") {
    return { run: defOrHandler };
  }
  return defOrHandler;
}
