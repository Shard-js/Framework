import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { RestClient } from "../src/discord/rest/RestClient.js";
import { DiscordAPIError, HTTPError } from "../src/discord/rest/errors.js";

describe("RestClient & RateLimiter", () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;

  let requestCount = 0;
  let hitRateLimitOnce = false;
  let hit500Once = false;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requestCount++;

      // Rate limit test endpoint
      if (req.url === "/ratelimit") {
        if (!hitRateLimitOnce) {
          hitRateLimitOnce = true;
          res.writeHead(429, {
            "Content-Type": "application/json",
            "X-RateLimit-Bucket": "test-bucket",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset-After": "0.1",
            "Retry-After": "0.1",
          });
          res.end(JSON.stringify({ message: "You are being rate limited.", retry_after: 0.1 }));
          return;
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "X-RateLimit-Bucket": "test-bucket",
          "X-RateLimit-Remaining": "5",
        });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // Retry on 5xx endpoint
      if (req.url === "/server-error") {
        if (!hit500Once) {
          hit500Once = true;
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Bad Gateway" }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ recovered: true }));
        return;
      }

      // Auth check endpoint
      if (req.url === "/auth-check") {
        const auth = req.headers.authorization;
        const ua = req.headers["user-agent"];
        if (auth === "Bot test_token" && ua?.includes("DiscordBot")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ code: 0, message: "401: Unauthorized" }));
        }
        return;
      }

      // Discord API error endpoint
      if (req.url === "/api-error") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            code: 50035,
            message: "Invalid Form Body",
            errors: { name: { _errors: [{ code: "BASE_TYPE_REQUIRED" }] } },
          })
        );
        return;
      }

      // Default 404
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        serverBaseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("sends correct Bot Authorization and User-Agent headers", async () => {
    const client = new RestClient({
      token: "test_token",
      apiBaseUrl: serverBaseUrl,
    });

    const res = await client.get<{ ok: boolean }>("/auth-check");
    expect(res.ok).toBe(true);
  });

  it("automatically handles 429 rate limits with retry-after", async () => {
    const client = new RestClient({
      token: "test_token",
      apiBaseUrl: serverBaseUrl,
    });

    const res = await client.get<{ success: boolean }>("/ratelimit");
    expect(res.success).toBe(true);
    expect(hitRateLimitOnce).toBe(true);
  });

  it("automatically retries 5xx server errors with backoff", async () => {
    const client = new RestClient({
      token: "test_token",
      apiBaseUrl: serverBaseUrl,
    });

    const res = await client.get<{ recovered: boolean }>("/server-error");
    expect(res.recovered).toBe(true);
    expect(hit500Once).toBe(true);
  });

  it("throws DiscordAPIError with code and raw errors on 400", async () => {
    const client = new RestClient({
      token: "test_token",
      apiBaseUrl: serverBaseUrl,
    });

    try {
      await client.get("/api-error");
      expect.fail("Should have thrown DiscordAPIError");
    } catch (err: any) {
      expect(err).toBeInstanceOf(DiscordAPIError);
      expect(err.code).toBe(50035);
      expect(err.message).toContain("Invalid Form Body");
    }
  });
});
