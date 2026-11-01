import { describe, it, expect, vi } from "vitest";
import { createBot } from "../src/bot/createBot.js";

describe("Gateway Event Single Execution (P0 Issue #2)", () => {
  it("executes default-branch gateway events exactly once", async () => {
    const bot = createBot({ token: "test-token" });

    const voiceHandler = vi.fn();
    bot.router.events.set("voiceStateUpdate", [
      {
        event: "voiceStateUpdate",
        run: voiceHandler,
      },
    ]);

    // Simulate Gateway dispatch event
    (bot.client as any).handleDispatch("VOICE_STATE_UPDATE", {
      user_id: "123",
      channel_id: "456",
    });

    expect(voiceHandler).toHaveBeenCalledTimes(1);
  });
});
