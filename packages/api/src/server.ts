import http from "node:http";
import { Readable } from "node:stream";
import colors from "picocolors";
import { ApiRouter } from "./router.js";
import type { ApiServerConfig, RouteHandlerContext } from "./types.js";

export class ApiServer {
  private server: http.Server | null = null;
  public router: ApiRouter;
  private config: ApiServerConfig;
  private contextProvider: () => Record<string, any>;

  constructor(
    config: ApiServerConfig = {},
    contextProvider: () => Record<string, any> = () => ({})
  ) {
    this.config = config;
    this.router = new ApiRouter(config.prefix || "/api");
    this.contextProvider = contextProvider;
  }

  public setContextProvider(provider: () => Record<string, any>): void {
    this.contextProvider = provider;
  }

  public async start(): Promise<{ port: number; host: string }> {
    const port = this.config.port ?? 3000;
    const host = this.config.host ?? "0.0.0.0";

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
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

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(port, host, () => {
        resolve({ port, host });
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
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

    const originHeader = req.headers.origin;
    if (originHeader) {
      if (typeof cors.origin === "string") {
        res.setHeader("Access-Control-Allow-Origin", cors.origin);
      } else if (Array.isArray(cors.origin)) {
        if (cors.origin.includes(originHeader) || cors.origin.includes("*")) {
          res.setHeader("Access-Control-Allow-Origin", originHeader);
        }
      } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (cors.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    const methods = cors.methods ?? ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
    res.setHeader("Access-Control-Allow-Methods", methods.join(", "));

    const headers = cors.headers ?? ["Content-Type", "Authorization"];
    res.setHeader("Access-Control-Allow-Headers", headers.join(", "));

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return true;
    }

    return false;
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (this.applyCorsHeaders(req, res)) {
      return;
    }

    const protocol = (req.socket as any).encrypted ? "https" : "http";
    const host = req.headers.host || `localhost:${this.config.port ?? 3000}`;
    const rawUrl = req.url || "/";
    const fullUrl = new URL(rawUrl, `${protocol}://${host}`);

    const matched = this.router.match(fullUrl.pathname, req.method || "GET");

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

    // Convert node incoming request to Web Standard Request
    const webRequest = this.toWebRequest(req, fullUrl);

    // Build context with bot, db, plugins, params
    const baseContext = this.contextProvider();
    const ctx: RouteHandlerContext = {
      ...baseContext,
      request: webRequest,
      params: matched.params,
      url: fullUrl,
    };

    // Execute route handler
    const response = await matched.handler(ctx);

    // Pipe Web Response to Node ServerResponse
    await this.sendWebResponse(res, response);
  }

  private toWebRequest(req: http.IncomingMessage, url: URL): Request {
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

    const body = hasBody
      ? (Readable.toWeb(req) as unknown as ReadableStream)
      : null;

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
    response: Response
  ): Promise<void> {
    res.statusCode = response.status;
    res.statusMessage = response.statusText;

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(Buffer.from(value));
        }
      }
    } finally {
      res.end();
    }
  }
}
