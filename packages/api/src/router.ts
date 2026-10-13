import type { ApiRoute, RouteHandler } from "./types.js";

/**
 * Normalizes a file path relative to `src/app/api` to a URL route pattern.
 * e.g., 'guilds/[id]/route.ts' -> '/api/guilds/:id'
 */
export function filePathToRoute(relativePath: string, prefix = "/api"): string {
  // Normalize Windows separators
  let normalized = relativePath.replace(/\\/g, "/");

  // Remove leading slashes and route.ts/js
  normalized = normalized.replace(/^[/]+/, "");
  normalized = normalized.replace(/\/?route\.(ts|js|mjs)$/, "");

  if (normalized === "" || normalized === ".") {
    return prefix;
  }

  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return `${cleanPrefix}/${normalized}`;
}

/**
 * Creates regex and param names from route path
 * e.g. /api/guilds/:id -> { pattern: /^\/api\/guilds\/(?<id>[^/]+)\/?$/, paramNames: ['id'] }
 */
export function routeToMatcher(routePath: string): {
  pattern: RegExp;
  paramNames: string[];
} {
  const paramNames: string[] = [];

  // Replace Next.js style dynamic segments [id] and [...slug]
  let regexStr = routePath
    .replace(/\[\.\.\.([^\]]+)\]/g, (_, param) => {
      paramNames.push(param);
      return `(?<${param}>.+)`;
    })
    .replace(/\[([^\]]+)\]/g, (_, param) => {
      paramNames.push(param);
      return `(?<${param}>[^/]+)`;
    });

  // Ensure leading slash and optional trailing slash
  if (!regexStr.startsWith("/")) {
    regexStr = `/${regexStr}`;
  }

  const pattern = new RegExp(`^${regexStr}\\/?$`);
  return { pattern, paramNames };
}

export class ApiRouter {
  private routes: ApiRoute[] = [];
  private prefix: string;

  constructor(prefix = "/api") {
    this.prefix = prefix;
  }

  public register(
    filePath: string,
    methods: Record<string, RouteHandler>
  ): ApiRoute {
    const routePath = filePathToRoute(filePath, this.prefix);
    const { pattern, paramNames } = routeToMatcher(routePath);

    const route: ApiRoute = {
      pattern,
      paramNames,
      methods,
      filePath,
      routePath,
    };

    // Remove existing if registered
    this.routes = this.routes.filter((r) => r.routePath !== routePath);
    this.routes.push(route);
    return route;
  }

  public clear(): void {
    this.routes = [];
  }

  public match(
    pathname: string,
    method: string
  ): {
    route: ApiRoute;
    handler: RouteHandler;
    params: Record<string, string>;
  } | null {
    for (const route of this.routes) {
      const match = route.pattern.exec(pathname);
      if (match) {
        const handler = route.methods[method.toUpperCase()];
        if (typeof handler === "function") {
          const params: Record<string, string> = {};
          if (match.groups) {
            for (const [key, value] of Object.entries(match.groups)) {
              if (value !== undefined) {
                params[key] = decodeURIComponent(value);
              }
            }
          }
          return { route, handler, params };
        }
      }
    }
    return null;
  }

  public getRoutes(): ApiRoute[] {
    return [...this.routes];
  }
}
