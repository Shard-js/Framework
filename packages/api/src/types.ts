export interface RouteHandlerContext {
  request: Request;
  params: Record<string, string>;
  url: URL;
  bot?: any;
  db?: any;
  [key: string]: any;
}

export type RouteHandler = (
  ctx: RouteHandlerContext
) => Promise<Response> | Response;

export interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
  HEAD?: RouteHandler;
  OPTIONS?: RouteHandler;
  default?: RouteHandler | Record<string, RouteHandler>;
}

export interface ApiRoute {
  pattern: RegExp;
  paramNames: string[];
  methods: Record<string, RouteHandler>;
  filePath: string;
  routePath: string;
}

export interface CorsConfig {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

export interface ApiServerConfig {
  port?: number;
  host?: string;
  prefix?: string;
  cors?: CorsConfig;
}
