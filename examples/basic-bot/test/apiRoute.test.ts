import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Example API Route Security (Issue #7)", () => {
  beforeEach(() => {
    process.env.API_SECRET = "super-secret-12345";
  });

  it("rejects unauthorized requests with 401", async () => {
    const { POST } = await import("../src/app/api/guilds/[id]/route.js");

    const req = new Request("http://localhost:3000/api/guilds/123", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: "456", message: "@everyone malicious" }),
    });

    const res = await POST({
      request: req,
      params: { id: "123" },
      url: new URL("http://localhost:3000/api/guilds/123"),
      bot: { guilds: new Map() },
    } as any);

    expect(res.status).toBe(401);
  });

  it("sends message with allowedMentions: { parse: [] } when authorized", async () => {
    const { POST } = await import("../src/app/api/guilds/[id]/route.js");

    const req = new Request("http://localhost:3000/api/guilds/123", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer super-secret-12345",
      },
      body: JSON.stringify({ channelId: "456", message: "@everyone Hello" }),
    });

    let sentPayload: any = null;
    const mockChannel = {
      id: "456",
      isTextBased: () => true,
      send: async (payload: any) => {
        sentPayload = payload;
      },
    };

    const mockGuild = {
      id: "123",
      channels: {
        cache: new Map([["456", mockChannel]]),
      },
    };

    const mockBot = {
      guilds: new Map([["123", mockGuild]]),
      channels: new Map(),
    };

    const res = await POST({
      request: req,
      params: { id: "123" },
      url: new URL("http://localhost:3000/api/guilds/123"),
      bot: mockBot,
    } as any);

    expect(res.status).toBe(200);
    expect(sentPayload).toBeDefined();
    expect(sentPayload.content).toBe("@everyone Hello");
    expect(sentPayload.allowedMentions).toEqual({ parse: [] });
  });
});
