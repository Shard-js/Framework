
export class HTTPError extends Error {
  public status: number;
  public statusText: string;
  public method: string;
  public url: string;

  constructor(status: number, statusText: string, method: string, url: string, message?: string) {
    super(message || `HTTP ${status} ${statusText} on ${method} ${url}`);
    this.name = "HTTPError";
    this.status = status;
    this.statusText = statusText;
    this.method = method;
    this.url = url;
  }
}

export class DiscordAPIError extends HTTPError {
  public code: number;
  public rawErrors?: any;

  constructor(
    status: number,
    statusText: string,
    method: string,
    url: string,
    code: number,
    message: string,
    rawErrors?: any
  ) {
    super(status, statusText, method, url, `[DiscordAPIError ${code}] ${message}`);
    this.name = "DiscordAPIError";
    this.code = code;
    this.rawErrors = rawErrors;
  }
}

export class RateLimitError extends Error {
  public retryAfter: number;
  public global: boolean;
  public limit?: number;
  public bucket?: string;

  constructor(retryAfter: number, global: boolean, limit?: number, bucket?: string) {
    super(`Rate limit hit: retry after ${retryAfter}ms (global: ${global})`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.global = global;
    this.limit = limit;
    this.bucket = bucket;
  }
}
