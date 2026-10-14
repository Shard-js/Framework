import http from "node:http";
import { Readable, Transform } from "node:stream";
import { timingSafeEqual } from "node:crypto";
import colors from "picocolors";
import { ApiRouter } from "./router.js";
import type { ApiServerConfig, RouteHandlerContext } from "./types.js";

interface IpRateLimitState {
  count: number;
  resetTime: number;
}

export class ApiServer {
  private server: http.Server | null = null;
  public router: ApiRouter;
  private config: ApiServerConfig;
  private contextProvider: () => Record<string, any>;
  private ipRateLimits = new Map<string, IpRateLimitState>();

  constructor(
    config: ApiServerConfig = {},
    contextProvider: () => Record<string, any> = () => ({})
  ) {
    this.config = config;
    this.router = new ApiRouter(config.prefix || "/api");
    this.contextProvider = contextProvider;

    const cors = this.config.cors;
    if (cors) {
      const origins = Array.isArray(cors.origin)
        ? cors.origin
        : cors.origin
        ? [cors.origin]
        : [];
      if (origins.includes("*") && cors.credentials) {
        throw new Error(
          "[shard:api] Security Error: cors.origin '*' cannot be combined with cors.credentials: true."
        );
      }
    }
  }

  public setContextProvider(provider: () => Record<string, any>): void {
    this.contextProvider = provider;
  }

  public async start(): Promise<{ port: number; host: string }> {
    const port = this.config.port ?? 3000;
    const host = this.config.host ?? "127.0.0.1";

    if (host === "0.0.0.0") {
      console.warn(
        colors.yellow(
          "[shard:api] Warning: API server listening on 0.0.0.0 (publicly exposed). Set host: '127.0.0.1' for local-only binding."
        )
      );
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        req.on("error", () => {});
        res.on("error", () => {});
        try {
          await this.handleRequest(req, res);
        } catch (error: any) {
          console.error(colors.red("[shard:api] Unhandled error:"), error);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal Server Error" }));
          }
        }
      });

      this.server.requestTimeout = this.config.requestTimeoutMs ?? 30_000;
      this.server.headersTimeout = this.config.headersTimeoutMs ?? 15_000;
      this.server.keepAliveTimeout = this.config.keepAliveTimeoutMs ?? 5_000;
      this.server.maxConnections = this.config.maxConnections ?? 1_000;

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(port, host, () => {
        const addr = this.server?.address();
        const resolvedPort = typeof addr === "object" && addr ? addr.port : port;
        resolve({ port: resolvedPort, host });
      });
    });
  }

  public async stop(): Promise<void> {
    this.ipRateLimits.clear();
    return new Promise((resolve) => {
      if (this.server) {
        if (typeof (this.server as any).closeAllConnections === "function") {
          (this.server as any).closeAllConnections();
        }
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private applyCorsHeaders(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): boolean {
    const cors = this.config.cors;
    if (!cors) return false;

    res.setHeader("Vary", "Origin");

    const allowed = Array.isArray(cors.origin)
      ? cors.origin
      : cors.origin
      ? [cors.origin]
      : [];
    const wildcard = allowed.includes("*");
    const originHeader = req.headers.origin;

    const isAllowed =
      wildcard || (originHeader && allowed.includes(originHeader));

    if (originHeader && isAllowed) {
      res.setHeader(
        "Access-Control-Allow-Origin",
        wildcard && !cors.credentials ? "*" : originHeader
      );
      if (cors.credentials && !wildcard) {
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
    }

    const methods =
      cors.methods ?? ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
    res.setHeader("Access-Control-Allow-Methods", methods.join(", "));

    const headers = cors.headers ?? ["Content-Type", "Authorization"];
    res.setHeader("Access-Control-Allow-Headers", headers.join(", "));

    if (req.method === "OPTIONS") {
      if (originHeader && !isAllowed) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "CORS: Origin not allowed" }));
        return true;
      }
      res.writeHead(204);
      res.end();
      return true;
    }

    return false;
  }

  private checkRateLimit(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!this.config.rateLimit) return true;

    if (this.ipRateLimits.size > 500) {
      const currentTime = Date.now();
      for (const [key, state] of this.ipRateLimits.entries()) {
        if (currentTime > state.resetTime) {
          this.ipRateLimits.delete(key);
        }
      }
    }

    const ip = req.socket.remoteAddress || "unknown";
    const windowMs = this.config.rateLimit.windowMs ?? 60_000;
    const max = this.config.rateLimit.max ?? 100;

    const now = Date.now();
    let state = this.ipRateLimits.get(ip);

    if (!state || now > state.resetTime) {
      state = { count: 1, resetTime: now + windowMs };
      this.ipRateLimits.set(ip, state);
      return true;
    }

    state.count++;
    if (state.count > max) {
      const retryAfterSec = Math.ceil((state.resetTime - now) / 1000);
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      });
      res.end(JSON.stringify({ error: "Too Many Requests", retryAfter: retryAfterSec }));
      return false;
    }

    return true;
  }

  private checkAuth(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!this.config.auth) return true;

    const expectedBearer = this.config.auth.bearer;
    if (expectedBearer) {
      const authHeader = req.headers.authorization || "";
      const expected = Buffer.from(`Bearer ${expectedBearer}`);
      const got = Buffer.from(authHeader);

      const isMatch =
        expected.length > 7 &&
        got.length === expected.length &&
        timingSafeEqual(got, expected);

      if (!isMatch) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return false;
      }
    }

    const expectedApiKey = this.config.auth.apiKey;
    if (expectedApiKey) {
      const apiKeyHeader = (req.headers["x-api-key"] as string) || "";
      const expected = Buffer.from(expectedApiKey);
      const got = Buffer.from(apiKeyHeader);

      const isMatch =
        expected.length > 0 &&
        got.length === expected.length &&
        timingSafeEqual(got, expected);

      if (!isMatch) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return false;
      }
    }

    return true;
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (this.applyCorsHeaders(req, res)) {
      return;
    }

    if (!this.checkRateLimit(req, res)) {
      return;
    }

    if (!this.checkAuth(req, res)) {
      return;
    }

    const protocol = (req.socket as any).encrypted ? "https" : "http";
    const port = this.config.port ?? 3000;
    const rawUrl = req.url || "/";

    let fullUrl: URL;
    try {
      let base: string;
      if (this.config.publicUrl) {
        base = this.config.publicUrl;
      } else if (this.config.trustHostHeader && req.headers.host) {
        base = `${protocol}://${req.headers.host}`;
      } else if (
        this.config.allowedHosts &&
        req.headers.host &&
        this.config.allowedHosts.includes(req.headers.host)
      ) {
        base = `${protocol}://${req.headers.host}`;
      } else {
        base = `${protocol}://localhost:${port}`;
      }
      fullUrl = new URL(rawUrl, base);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad Request", message: "Invalid URL or Host header" }));
      return;
    }

    const matched = this.router.match(fullUrl.pathname, req.method || "GET");

    if (matched && matched.malformed) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Malformed percent-encoded URL parameter",
        })
      );
      return;
    }

    if (!matched) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Not Found",
          message: `Cannot ${req.method} ${fullUrl.pathname}`,
        })
      );
      return;
    }

    if (matched.methodNotAllowed) {
      const allowed = matched.allowedMethods?.join(", ") || "GET";
      res.setHeader("Allow", allowed);
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Method Not Allowed",
          message: `Method ${req.method} not allowed on ${fullUrl.pathname}`,
          allowedMethods: matched.allowedMethods,
        })
      );
      return;
    }

    const maxBodySize = this.config.maxBodySize ?? 1_048_576;
    const contentLength = req.headers["content-length"];
    if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payload Too Large", maxBytes: maxBodySize }));
      return;
    }

    const webRequest = this.toWebRequest(req, fullUrl, maxBodySize, res);
    if (!webRequest) {
      return;
    }

    const baseContext = this.contextProvider();
    const ctx: RouteHandlerContext = {
      ...baseContext,
      request: webRequest,
      params: matched.params,
      url: fullUrl,
    };

    try {
      const response = await matched.handler!(ctx);
      if (!(response instanceof Response)) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Route handler must return a Web Standard Response instance.",
          })
        );
        return;
      }
      await this.sendWebResponse(res, response, req.method);
    } catch (err: any) {
      if (err?.message === "PAYLOAD_TOO_LARGE" || err?.message?.includes("Payload Too Large")) {
        if (!res.headersSent) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Payload Too Large", maxBytes: maxBodySize }));
        }
        return;
      }
      const status =
        typeof err?.status === "number" && err.status >= 400 && err.status < 600
          ? err.status
          : 500;
      if (!res.headersSent) {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: status === 500 ? "Internal Server Error" : "Error",
            message: err?.message || "An unexpected error occurred",
          })
        );
      }
    }
  }

  private toWebRequest(
    req: http.IncomingMessage,
    url: URL,
    maxBodySize: number,
    res: http.ServerResponse
  ): Request | null {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }
    }

    const hasBody =
      req.method !== "GET" &&
      req.method !== "HEAD" &&
      req.headers["content-length"] !== "0";

    if (!hasBody) {
      return new Request(url.toString(), {
        method: req.method,
        headers,
        body: null,
      });
    }

    let bytesReceived = 0;
    const limiter = new Transform({
      transform(chunk, encoding, callback) {
        bytesReceived += chunk.length;
        if (bytesReceived > maxBodySize) {
          const err = new Error("PAYLOAD_TOO_LARGE");
          callback(err);
        } else {
          callback(null, chunk);
        }
      },
    });

    req.on("error", (err) => {
      limiter.destroy(err);
    });
    req.pipe(limiter);

    limiter.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload Too Large", maxBytes: maxBodySize }));
      }
      req.destroy();
    });

    const body = Readable.toWeb(limiter) as unknown as ReadableStream;

    return new Request(url.toString(), {
      method: req.method,
      headers,
      body,
      // @ts-ignore - duplex is needed in Node fetch/request
      duplex: "half",
    });
  }

  private async sendWebResponse(
    res: http.ServerResponse,
    response: Response,
    method = "GET"
  ): Promise<void> {
    res.statusCode = response.status;
    res.statusMessage = response.statusText;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (method.toUpperCase() === "HEAD" || !response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();

    res.on("close", () => {
      reader.cancel().catch(() => {});
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && !res.destroyed && !res.writableEnded) {
          res.write(Buffer.from(value));
        }
      }
    } catch {
    } finally {
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    }
  }
}
