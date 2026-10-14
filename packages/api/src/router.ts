import type { ApiRoute, RouteHandler } from "./types.js";

export function filePathToRoute(relativePath: string, prefix = "/api"): string {
  let normalized = relativePath.replace(/\\/g, "/");

  normalized = normalized.replace(/^[/]+/, "");
  normalized = normalized.replace(/\/?route\.(ts|js|mjs)$/, "");

  if (normalized === "" || normalized === ".") {
    return prefix;
  }

  const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return `${cleanPrefix}/${normalized}`;
}

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
  handler?: RouteHandler;
  params: Record<string, string>;
  malformed?: boolean;
  methodNotAllowed?: boolean;
  allowedMethods?: string[];
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

    this.routes = this.routes.filter((r) => r.routePath !== routePath);
    this.routes.push(route);
    return route;
  }

  public clear(): void {
    this.routes = [];
  }

  public match(pathname: string, method: string): MatchResult | null {
    const upperMethod = method.toUpperCase();
    let matchedPathRoute: ApiRoute | null = null;
    let matchedPathParams: Record<string, string> = {};

    for (const route of this.routes) {
      const match = route.pattern.exec(pathname);
      if (match) {
        const params: Record<string, string> = {};
        let isMalformed = false;
        let isPathTraversal = false;

        if (match.groups) {
          for (const [key, value] of Object.entries(match.groups)) {
            if (value !== undefined) {
              const decoded = safeDecode(value);
              if (decoded === null) {
                isMalformed = true;
                break;
              }

              const isCatchAll = route.catchAll.has(key);
              if (!isCatchAll && /[\/\\]/.test(decoded)) {
                isPathTraversal = true;
                break;
              }

              params[key] = decoded;
            }
          }
        }

        if (isMalformed) {
          return { route, params: {}, malformed: true };
        }
        if (isPathTraversal) {
          continue;
        }

        let handler = route.methods[upperMethod];
        if (!handler && upperMethod === "HEAD" && typeof route.methods.GET === "function") {
          handler = route.methods.GET;
        }

        if (typeof handler === "function") {
          return { route, handler, params };
        }

        if (!matchedPathRoute) {
          matchedPathRoute = route;
          matchedPathParams = params;
        }
      }
    }

    if (matchedPathRoute) {
      const allowedMethods = Object.keys(matchedPathRoute.methods);
      if (allowedMethods.includes("GET") && !allowedMethods.includes("HEAD")) {
        allowedMethods.push("HEAD");
      }
      return {
        route: matchedPathRoute,
        params: matchedPathParams,
        methodNotAllowed: true,
        allowedMethods,
      };
    }

    return null;
  }

  public getRoutes(): ApiRoute[] {
    return [...this.routes];
  }
}
