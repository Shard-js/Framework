import { API_BASE, API_VERSION } from "./Endpoints.js";
import { RateLimiter } from "./RateLimiter.js";
import { DiscordAPIError, HTTPError, RateLimitError } from "./errors.js";

export interface RestClientOptions {
  token?: string;
  apiBaseUrl?: string;
  version?: string;
  timeout?: number;
  maxRetries?: number;
  userAgent?: string;
}

export interface RequestOptions {
  body?: any;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  auth?: boolean;
}

export class RestClient {
  private token?: string;
  private apiBaseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private userAgent: string;
  private rateLimiter: RateLimiter;

  constructor(options: RestClientOptions = {}) {
    this.token = options.token;
    this.apiBaseUrl = options.apiBaseUrl || `https://discord.com/api/v${options.version || API_VERSION}`;
    this.timeout = options.timeout ?? 15_000;
    this.maxRetries = options.maxRetries ?? 3;
    this.userAgent =
      options.userAgent || "DiscordBot (https://github.com/Shard-js/Framework, 0.2.0)";
    this.rateLimiter = new RateLimiter();
  }

  public setToken(token: string): this {
    this.token = token;
    return this;
  }

  public getToken(): string | undefined {
    return this.token;
  }

  public async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", endpoint, options);
  }

  public async post<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", endpoint, options);
  }

  public async put<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", endpoint, options);
  }

  public async patch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PATCH", endpoint, options);
  }

  public async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", endpoint, options);
  }

  public async request<T = any>(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const routeKey = this.rateLimiter.getRouteKey(method, endpoint);

    return this.rateLimiter.execute<T>(routeKey, async () => {
      return this.executeRequest<T>(method, endpoint, routeKey, options);
    });
  }

  private async executeRequest<T>(
    method: string,
    endpoint: string,
    routeKey: string,
    options: RequestOptions,
    attempt = 0
  ): Promise<{ response: Response; data: T }> {
    let url = endpoint.startsWith("http")
      ? endpoint
      : `${this.apiBaseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    if (options.query) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(options.query)) {
        if (v !== undefined) searchParams.append(k, String(v));
      }
      const qs = searchParams.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const headers = new Headers(options.headers);
    headers.set("User-Agent", this.userAgent);

    if (options.auth !== false && this.token) {
      headers.set("Authorization", this.token.startsWith("Bot ") ? this.token : `Bot ${this.token}`);
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 429 Rate Limits
      if (response.status === 429) {
        let retryAfterMs = 1000;
        let isGlobal = response.headers.get("x-ratelimit-global") === "true";

        try {
          const errorJson: any = await response.json();
          if (typeof errorJson?.retry_after === "number") {
            retryAfterMs = Math.ceil(errorJson.retry_after * 1000);
          }
          if (errorJson?.global !== undefined) {
            isGlobal = Boolean(errorJson.global);
          }
        } catch {
          const retryHeader = response.headers.get("retry-after");
          if (retryHeader) {
            retryAfterMs = Math.ceil(parseFloat(retryHeader) * 1000);
          }
        }

        this.rateLimiter.updateHeaders(routeKey, response.headers, 429, retryAfterMs);

        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, retryAfterMs));
          return this.executeRequest<T>(method, endpoint, routeKey, options, attempt + 1);
        }

        throw new RateLimitError(retryAfterMs, isGlobal);
      }

      this.rateLimiter.updateHeaders(routeKey, response.headers, response.status);

      // Handle Server Errors (5xx) with Exponential Backoff
      if (response.status >= 500 && response.status < 600) {
        if (attempt < this.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10_000);
          await new Promise((r) => setTimeout(r, backoff));
          return this.executeRequest<T>(method, endpoint, routeKey, options, attempt + 1);
        }
        throw new HTTPError(response.status, response.statusText, method, url);
      }

      // Handle Client Errors (4xx)
      if (response.status >= 400) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }

        if (errorData && typeof errorData.code === "number") {
          throw new DiscordAPIError(
            response.status,
            response.statusText,
            method,
            url,
            errorData.code,
            errorData.message || response.statusText,
            errorData.errors
          );
        }

        throw new HTTPError(
          response.status,
          response.statusText,
          method,
          url,
          errorData?.message
        );
      }

      // 204 No Content
      if (response.status === 204) {
        return { response, data: undefined as unknown as T };
      }

      const contentType = response.headers.get("content-type") || "";
      let data: T;
      if (contentType.includes("application/json")) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { response, data };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        throw new HTTPError(408, "Request Timeout", method, url, `Request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }
}
