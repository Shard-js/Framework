import type { ApiRoute, RouteHandler } from "./types.js";

/**
 * Normalizes a file path relative to `src/app/api` to a URL route pattern.
 * e.g., 'guilds/[id]/route.ts' -> '/api/guilds/[id]'
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
 * Escapes static segments and validates param names (Fixes #14).
 */
export function routeToMatcher(routePath: string): {
  pattern: RegExp;
  paramNames: string[];
  catchAll: Set<string>;
} {
  const paramNames: string[] = [];
  const catchAll = new Set<string>();

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const NAME_RE = /^[A-Za-z_$][\w$]*$/;

  const parts = routePath
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      const catchAllMatch = seg.match(/^\[\.\.\.(.+)\]$/);
      const dynMatch = seg.match(/^\[(.+)\]$/);
      const name = catchAllMatch?.[1] ?? dynMatch?.[1];

      if (name) {
        if (!NAME_RE.test(name)) {
          throw new Error(`Invalid param name: "${name}". Param names must be valid identifiers.`);
        }
        if (paramNames.includes(name)) {
          throw new Error(`Invalid param name (duplicate): "${name}" in route "${routePath}".`);
        }
        paramNames.push(name);

        if (catchAllMatch) {
          catchAll.add(name);
          return `(?<${name}>.+)`;
        }
        return `(?<${name}>[^/]+)`;
      }

      return esc(seg);
    });

  const pattern = new RegExp(`^/${parts.join("/")}/?$`);
  return { pattern, paramNames, catchAll };
}

function safeDecode(v: string): string | null {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
}

export interface MatchResult {
  route: ApiRoute;
  handler: RouteHandler;
  params: Record<string, string>;
  malformed?: boolean;
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
    const { pattern, paramNames, catchAll } = routeToMatcher(routePath);

    const route: ApiRoute = {
      pattern,
      paramNames,
      catchAll,
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

  public match(pathname: string, method: string): MatchResult | null {
    for (const route of this.routes) {
      const match = route.pattern.exec(pathname);
      if (match) {
        const handler = route.methods[method.toUpperCase()];
        if (typeof handler === "function") {
          const params: Record<string, string> = {};
          if (match.groups) {
            for (const [key, value] of Object.entries(match.groups)) {
              if (value !== undefined) {
                const decoded = safeDecode(value);
                // Malformed percent-encoding returns malformed flag for 400 Bad Request (Fix #12)
                if (decoded === null) {
                  return { route, handler, params: {}, malformed: true };
                }

                // If not catch-all, single segment must not contain slashes (Fix #12: %2F path traversal)
                const isCatchAll = route.catchAll.has(key);
                if (!isCatchAll && /[\/\\]/.test(decoded)) {
                  return null;
                }

                params[key] = decoded;
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
