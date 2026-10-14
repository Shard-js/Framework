import { describe, it, expect } from "vitest";
import path from "node:path";
import { FileRouter } from "../src/router/fileRouter.js";

function norm(p: string): string {
  return path.resolve(p).replace(/\\/g, "/");
}

describe("HMR & Listener Deregistration (Issue #1)", () => {
  it("prevents listener accumulation on repeated file reloads", async () => {
    const router = new FileRouter();
    const eventFile = norm("src/events/ready.ts");

    // Mock loadEvents
    let version = 1;
    router.loadEvents = async () => {
      const eventDef = {
        event: "ready",
        filePath: eventFile,
        run: () => version,
      };

      const list = router.events.get(eventDef.event) || [];
      list.push(eventDef as any);
      router.events.set(eventDef.event, list);
      (router as any).fileDefinitions.set(eventFile, {
        type: "event",
        key: eventDef.event,
      });
    };

    // Initial load
    await router.loadEvents();
    expect(router.events.get("ready")).toHaveLength(1);

    // Simulate 5 consecutive HMR reloads on the same file
    for (let i = 2; i <= 6; i++) {
      version = i;
      await router.reloadFile(eventFile);
      // Must NOT accumulate duplicates
      expect(router.events.get("ready")).toHaveLength(1);
    }

    const handler = router.events.get("ready")![0];
    expect(handler.run({} as any)).toBe(6);
  });

  it("cleans up orphaned commands when file is deleted or renamed", async () => {
    const router = new FileRouter();
    const cmdFile = norm("src/commands/ping.ts");

    // Register a command
    router.commands.set("ping", {
      name: "ping",
      description: "Ping command",
      filePath: cmdFile,
      run: () => {},
    });
    (router as any).fileDefinitions.set(cmdFile, {
      type: "command",
      key: "ping",
    });

    expect(router.commands.has("ping")).toBe(true);

    // Mock loadCommands to do nothing (simulating file was removed)
    router.loadCommands = async () => {};

    // Reloading deleted file removes it from router.commands
    await router.reloadFile(cmdFile);
    expect(router.commands.has("ping")).toBe(false);
  });
});
