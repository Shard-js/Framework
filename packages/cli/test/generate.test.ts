import { describe, it, expect } from "vitest";
import { getTemplate } from "../src/commands/generate.js";

describe("shard generate template resolver", () => {
  it("generates slash command template with SlashCommandBuilder", () => {
    const { filePath, content } = getTemplate("command", "kick-member");
    expect(filePath).toBe("src/commands/kick-member.ts");
    expect(content).toContain("defineCommand");
    expect(content).toContain("SlashCommandBuilder");
    expect(content).toContain(".setName(\"kick-member\")");
  });

  it("generates event template", () => {
    const { filePath, content } = getTemplate("event", "guildMemberAdd");
    expect(filePath).toBe("src/events/guildMemberAdd.ts");
    expect(content).toContain("defineEvent");
    expect(content).toContain("guildMemberAdd");
  });

  it("generates API route template", () => {
    const { filePath, content } = getTemplate("route", "users");
    expect(filePath).toBe("src/app/api/users/route.ts");
    expect(content).toContain("defineRoute");
    expect(content).toContain("GET");
    expect(content).toContain("POST");
  });

  it("generates middleware template", () => {
    const { filePath, content } = getTemplate("middleware", "rate-limit");
    expect(filePath).toBe("src/middleware/rate-limit.ts");
    expect(content).toContain("defineMiddleware");
    expect(content).toContain("name: \"rate-limit\"");
  });

  it("generates component template", () => {
    const { filePath, content } = getTemplate("component", "verify-button");
    expect(filePath).toBe("src/components/verify-button.ts");
    expect(content).toContain("customId: \"verify-button\"");
  });

  it("throws error on unknown type", () => {
    expect(() => getTemplate("invalid", "test")).toThrowError(/Unknown generator type/);
  });
});
