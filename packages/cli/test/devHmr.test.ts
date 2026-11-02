import { describe, it, expect, vi } from "vitest";
import { FileRouter } from "@shardjs-framework/core";
import path from "node:path";

function norm(p: string): string {
  return path.resolve(p).replace(/\\/g, "/");
}

describe("HMR add & unlink file events (P1 Issue #7)", () => {
  it("reloadFile correctly handles newly added command file", async () => {
    const router = new FileRouter();
    const newCmdFile = norm("src/commands/info.ts");

    let loadCommandsCalled = false;
    router.loadCommands = async () => {
      loadCommandsCalled = true;
      router.commands.set("info", {
        name: "info",
        description: "Bot info",
        run: () => "info",
      });
    };

    const category = await router.reloadFile(newCmdFile);
    expect(category).toBe("commands");
    expect(loadCommandsCalled).toBe(true);
    expect(router.commands.has("info")).toBe(true);
  });

  it("reloadFile correctly handles deleted command file (unlink)", async () => {
    const router = new FileRouter();
    const deletedCmdFile = norm("src/commands/old.ts");

    router.commands.set("old", {
      name: "old",
      description: "Old command",
      filePath: deletedCmdFile,
      run: () => {},
    });
    (router as any).fileDefinitions.set(deletedCmdFile, {
      type: "command",
      key: "old",
    });

    expect(router.commands.has("old")).toBe(true);

    router.loadCommands = async () => {};

    const category = await router.reloadFile(deletedCmdFile);
    expect(category).toBe("commands");
    expect(router.commands.has("old")).toBe(false);
  });
});
