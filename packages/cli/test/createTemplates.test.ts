import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCreate } from "../src/commands/create.js";

describe("P3.14: create-shard project templates", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shard-create-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scaffolds the 'minimal' template", async () => {
    await runCreate("bot-minimal", { template: "minimal" });

    const projectDir = path.join(tmpDir, "bot-minimal");
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "shard.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/commands/ping.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/events/ready.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "package.json"))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("bot-minimal");
    expect(pkg.dependencies["@shardjs/core"]).toBeDefined();
    expect(pkg.dependencies["@shardjs/plugin-drizzle"]).toBeUndefined();
  });

  it("scaffolds the 'api-drizzle' template", async () => {
    await runCreate("bot-fullstack", { template: "api-drizzle" });

    const projectDir = path.join(tmpDir, "bot-fullstack");
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "shard.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/db/schema.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/db/index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/app/api/health/route.ts"))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("bot-fullstack");
    expect(pkg.dependencies["@shardjs/plugin-drizzle"]).toBeDefined();
    expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
  });

  it("scaffolds the 'moderation' template with folder subcommands & middleware", async () => {
    await runCreate("bot-mod", { template: "moderation" });

    const projectDir = path.join(tmpDir, "bot-mod");
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/commands/moderation/ban.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/commands/moderation/kick.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/commands/moderation/_middleware.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/commands/warn.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "src/events/guildCreate.ts"))).toBe(true);
  });
});
