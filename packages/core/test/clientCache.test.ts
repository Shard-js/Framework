import { describe, it, expect } from "vitest";
import { ClientCache } from "../src/discord/client/ClientCache.js";

describe("ClientCache discord.js compatibility (P1 Issue #8)", () => {
  it("allows accessing cache property as self reference", () => {
    const cache = new ClientCache<string, { id: string; name: string }>();
    cache.set("123", { id: "123", name: "MyGuild" });

    // Direct access
    expect(cache.get("123")?.name).toBe("MyGuild");

    // discord.js style: bot.guilds.cache.get(...)
    expect(cache.cache).toBe(cache);
    expect(cache.cache.get("123")?.name).toBe("MyGuild");
    expect(cache.cache.size).toBe(1);
    expect(cache.cache.has("123")).toBe(true);
  });
});
