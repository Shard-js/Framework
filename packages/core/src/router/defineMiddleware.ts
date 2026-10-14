import type {
  MiddlewareDefinition,
  MiddlewareHandler,
} from "../types/index.js";

export function defineMiddleware<T = any>(
  defOrHandler: MiddlewareDefinition<T> | MiddlewareHandler<T>
): MiddlewareDefinition<T> {
  if (typeof defOrHandler === "function") {
    return { run: defOrHandler };
  }
  return defOrHandler;
}
