import type { MiddlewareHandler } from "../types/index.js";

/**
 * Executes a middleware pipeline in onion-fashion (Koa/Hono model).
 */
export async function composeMiddlewares<T>(
  middlewares: MiddlewareHandler<T>[],
  ctx: T,
  finalHandler: (ctx: T) => Promise<any> | any
): Promise<any> {
  let index = -1;

  async function dispatch(i: number): Promise<any> {
    if (i <= index) {
      throw new Error("next() called multiple times in middleware");
    }
    index = i;

    const fn = middlewares[i];
    if (i === middlewares.length) {
      return await finalHandler(ctx);
    }

    if (!fn) return;

    return await fn(ctx, () => dispatch(i + 1));
  }

  return await dispatch(0);
}
