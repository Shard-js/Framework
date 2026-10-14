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
  catchAll: Set<string>;
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

export interface RateLimitConfig {
  windowMs?: number; // Time window in ms (default: 60_000)
  max?: number;      // Max requests per window per IP (default: 100)
}

export interface ApiAuthConfig {
  bearer?: string;
  apiKey?: string;
}

export interface ApiServerConfig {
  port?: number;
  host?: string;
  prefix?: string;
  cors?: CorsConfig;
  publicUrl?: string;
  allowedHosts?: string[];
  trustHostHeader?: boolean;
  maxBodySize?: number;       // Default: 1MB (1_048_576 bytes)
  requestTimeoutMs?: number;  // Default: 30_000ms
  headersTimeoutMs?: number;  // Default: 15_000ms
  keepAliveTimeoutMs?: number;// Default: 5_000ms
  maxConnections?: number;    // Default: 1_000
  rateLimit?: RateLimitConfig;
  auth?: ApiAuthConfig;
}
