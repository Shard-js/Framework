import { describe, it, expect, afterEach } from "vitest";
import { ApiServer } from "../src/server.js";

describe("ApiServer (Security Hardening)", () => {
  let server: ApiServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("throws on startup if cors.origin '*' is combined with credentials: true (Issue #10)", () => {
    expect(() => {
      new ApiServer({
        cors: {
          origin: "*",
          credentials: true,
        },
      });
    }).toThrowError(/cannot be combined with cors\.credentials: true/);
  });

  it("sets Vary: Origin and blocks disallowed origins on preflight OPTIONS (Issue #10)", async () => {
    server = new ApiServer({
      port: 0,
      cors: {
        origin: ["https://trusted.example"],
        credentials: true,
      },
    });

    server.router.register("health/route.ts", {
      GET: () => Response.json({ status: "ok" }),
    });

    const { port, host } = await server.start();
    const baseUrl = `http://${host}:${port}/api/health`;

    // 1. Allowed origin preflight
    const allowedRes = await fetch(baseUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "https://trusted.example",
      },
    });
    expect(allowedRes.status).toBe(204);
    expect(allowedRes.headers.get("vary")).toBe("Origin");
    expect(allowedRes.headers.get("access-control-allow-origin")).toBe("https://trusted.example");
    expect(allowedRes.headers.get("access-control-allow-credentials")).toBe("true");

    // 2. Disallowed origin preflight -> 403 Forbidden
    const disallowedRes = await fetch(baseUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
      },
    });
    expect(disallowedRes.status).toBe(403);
    expect(disallowedRes.headers.get("vary")).toBe("Origin");
  });

  it("enforces maxBodySize and returns 413 Payload Too Large (Issue #5)", async () => {
    server = new ApiServer({
      port: 0,
      maxBodySize: 1024, // 1 KB limit
    });

    server.router.register("upload/route.ts", {
      POST: async ({ request }) => {
        const text = await request.text();
        return Response.json({ receivedLength: text.length });
      },
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/upload`;

    // Oversized body (2 KB)
    const largeData = "x".repeat(2048);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: largeData,
    });

    expect(res.status).toBe(413);
  });

  it("protects against Host header injection and invalid Host headers (Issue #13)", async () => {
    server = new ApiServer({
      port: 0,
      publicUrl: "http://mybot.com:3000",
    });

    let observedUrl = "";
    server.router.register("info/route.ts", {
      GET: ({ url }) => {
        observedUrl = url.toString();
        return Response.json({ ok: true });
      },
    });

    const { port, host } = await server.start();
    const res = await fetch(`http://${host}:${port}/api/info`, {
      headers: {
        Host: "evil.attacker.example",
      },
    });

    expect(res.status).toBe(200);
    expect(observedUrl).toContain("mybot.com:3000");
    expect(observedUrl).not.toContain("evil.attacker.example");
  });

  it("returns 400 Bad Request on malformed percent-encoded route parameters (Issue #12)", async () => {
    server = new ApiServer({ port: 0 });
    server.router.register("items/[id]/route.ts", {
      GET: ({ params }) => Response.json({ id: params.id }),
    });

    const { port, host } = await server.start();
    const res = await fetch(`http://${host}:${port}/api/items/%E0%A4%A`);

    expect(res.status).toBe(400);
    const json: any = await res.json();
    expect(json.message).toContain("Malformed percent-encoded URL parameter");
  });

  it("enforces rate limiting and returns 429 Too Many Requests (Issue #11)", async () => {
    server = new ApiServer({
      port: 0,
      rateLimit: {
        windowMs: 5000,
        max: 3,
      },
    });

    server.router.register("ping/route.ts", {
      GET: () => Response.json({ pong: true }),
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/ping`;

    // Requests 1, 2, 3 should succeed
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url);
      expect(res.status).toBe(200);
    }

    // Request 4 should be rate limited (429)
    const rateLimitedRes = await fetch(url);
    expect(rateLimitedRes.status).toBe(429);
    expect(rateLimitedRes.headers.get("retry-after")).toBeDefined();
  });

  it("enforces API bearer authentication layer if configured (Issues #5 & #11)", async () => {
    server = new ApiServer({
      port: 0,
      auth: {
        bearer: "secret-token-123",
      },
    });

    server.router.register("secret/route.ts", {
      GET: () => Response.json({ data: "top secret" }),
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/secret`;

    // Without token -> 401
    const unauthRes = await fetch(url);
    expect(unauthRes.status).toBe(401);

    // With wrong token -> 401
    const wrongRes = await fetch(url, {
      headers: { Authorization: "Bearer wrong" },
    });
    expect(wrongRes.status).toBe(401);

    // With valid token -> 200
    const validRes = await fetch(url, {
      headers: { Authorization: "Bearer secret-token-123" },
    });
    expect(validRes.status).toBe(200);
    const json: any = await validRes.json();
    expect(json.data).toBe("top secret");
  });
});
