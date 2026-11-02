import { describe, it, expect, vi } from "vitest";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import { ComponentInteraction } from "../src/discord/interactions/ComponentInteraction.js";
import { ApplicationCommandType } from "../src/discord/types/interactions.js";

describe("Interaction Methods (fetchReply)", () => {
  it("fetches reply message using rest client on CommandInteraction", async () => {
    let requestedUrl = "";
    let requestedOptions: any = null;

    const mockRest: any = {
      get: vi.fn().mockImplementation((url, opts) => {
        requestedUrl = url;
        requestedOptions = opts;
        return Promise.resolve({
          id: "msg-12345",
          content: "Hello from bot",
        });
      }),
    };

    const raw: any = {
      id: "int-1",
      application_id: "app-999",
      token: "secret-token",
      data: { name: "test", type: ApplicationCommandType.ChatInput },
      user: { id: "u-1", username: "tester" },
    };

    const interaction = new CommandInteraction(raw, mockRest);
    const msg = await interaction.fetchReply();

    expect(msg.id).toBe("msg-12345");
    expect(requestedUrl).toBe("/webhooks/app-999/secret-token/messages/@original");
    expect(requestedOptions).toEqual({ auth: false });
  });

  it("fetches reply message on ComponentInteraction", async () => {
    let requestedUrl = "";

    const mockRest: any = {
      get: vi.fn().mockImplementation((url) => {
        requestedUrl = url;
        return Promise.resolve({
          id: "msg-comp-678",
        });
      }),
    };

    const raw: any = {
      id: "int-2",
      application_id: "app-888",
      token: "token-comp",
      data: { custom_id: "btn-click", component_type: 2 },
      user: { id: "u-2", username: "tester2" },
    };

    const interaction = new ComponentInteraction(raw, mockRest);
    const msg = await interaction.fetchReply();

    expect(msg.id).toBe("msg-comp-678");
    expect(requestedUrl).toBe("/webhooks/app-888/token-comp/messages/@original");
  });
});
