import { describe, it, expect, vi } from "vitest";
import { drizzlePlugin } from "../src/index.js";

describe("drizzlePlugin (Issue #3)", () => {
  it("injects real client into context when provided", async () => {
    const mockDb = { query: vi.fn(), select: vi.fn() };
    const plugin = drizzlePlugin({ client: mockDb });

    let injectedKey = "";
    let injectedValue: any = null;

    await plugin.setup?.({
      bot: {} as any,
      config: {},
      inject: (key, val) => {
        injectedKey = key;
        injectedValue = val;
      },
    });

    expect(injectedKey).toBe("db");
    expect(injectedValue).toBe(mockDb);
  });

  it("does not inject misleading mock object when client is omitted", async () => {
    const plugin = drizzlePlugin({});

    let injectedKey = "";
    let injectedValue: any = null;

    await plugin.setup?.({
      bot: {} as any,
      config: {},
      inject: (key, val) => {
        injectedKey = key;
        injectedValue = val;
      },
    });

    expect(injectedKey).toBe("");
    expect(injectedValue).toBeNull();
  });

  it("registers CLI commands db:migrate and db:push", () => {
    const plugin = drizzlePlugin({});
    const registeredCommands: string[] = [];

    const mockCmd = {
      command: (name: string) => {
        registeredCommands.push(name);
        return {
          option: () => ({ action: vi.fn() }),
          action: vi.fn(),
        };
      },
    };

    plugin.cli?.(mockCmd);
    expect(registeredCommands).toContain("db:migrate");
    expect(registeredCommands).toContain("db:push");
  });

  it("rejects malicious configPath containing shell metacharacters in executeDrizzleKit", async () => {
    const { executeDrizzleKit } = await import("../src/index.js");
    expect(() => executeDrizzleKit("migrate", "drizzle.config.ts; rm -rf /")).toThrowError(
      /Invalid config path containing illegal characters/
    );
    expect(() => executeDrizzleKit("push", "config.ts & calc.exe")).toThrowError(
      /Invalid config path containing illegal characters/
    );
  });

  it("teardown safely closes database client across various driver patterns", async () => {
    const endMock = vi.fn().mockResolvedValue(undefined);
    const clientDriver = { $client: { end: endMock } };
    const plugin = drizzlePlugin({ client: clientDriver });

    await plugin.teardown?.();
    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
