import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RestClient } from "../src/discord/rest/RestClient.js";
import { CommandInteraction } from "../src/discord/interactions/CommandInteraction.js";
import { Client } from "../src/discord/client/Client.js";

describe("Multipart File Uploads (P1 Issue #6)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("RestClient creates FormData with payload_json and files[n] and omits manual Content-Type", async () => {
    let capturedUrl = "";
    let capturedOptions: any = null;

    global.fetch = vi.fn().mockImplementation(async (url, opts) => {
      capturedUrl = url.toString();
      capturedOptions = opts;
      return new Response(JSON.stringify({ id: "msg-123", content: "hello with file" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new RestClient({ token: "fake-token" });

    const fileData = Buffer.from("test file content");
    const result = await client.post("/channels/12345/messages", {
      body: { content: "Here is your file" },
      files: [
        {
          name: "test.txt",
          data: fileData,
          contentType: "text/plain",
          description: "A test text file",
        },
      ],
    });

    expect(result.id).toBe("msg-123");
    expect(capturedUrl).toContain("/channels/12345/messages");
    expect(capturedOptions.body).toBeInstanceOf(FormData);

    const formData = capturedOptions.body as FormData;
    expect(formData.has("payload_json")).toBe(true);
    expect(formData.has("files[0]")).toBe(true);

    const payloadJson = JSON.parse(formData.get("payload_json") as string);
    expect(payloadJson.content).toBe("Here is your file");
    expect(payloadJson.attachments).toEqual([
      { id: 0, filename: "test.txt", description: "A test text file" },
    ]);

    // Content-Type must not be set to application/json so that FormData sets the boundary
    expect(capturedOptions.headers.get("content-type")).toBeNull();
  });

  it("CommandInteraction.reply forwards files to REST client", async () => {
    const mockPost = vi.fn().mockResolvedValue({});
    const fakeRest = { post: mockPost } as any;

    const interaction = new CommandInteraction(
      {
        id: "int-files",
        application_id: "app-files",
        token: "tok-files",
        version: 1,
        type: 2,
        data: { name: "export" },
      } as any,
      fakeRest
    );

    const file = {
      name: "data.csv",
      data: Buffer.from("id,name\n1,Alice"),
      contentType: "text/csv",
    };

    await interaction.reply({
      content: "Here is the export:",
      files: [file],
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [, opts] = mockPost.mock.calls[0];
    expect(opts.files).toEqual([file]);
    expect(opts.body.data.content).toBe("Here is the export:");
  });

  it("channel.send forwards files in client message enrichment", async () => {
    let capturedOptions: any = null;
    global.fetch = vi.fn().mockImplementation(async (_, opts) => {
      capturedOptions = opts;
      return new Response(JSON.stringify({ id: "msg-file" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = new Client({ token: "test-token" });
    const message = (client as any).enrichMessage({
      id: "orig-msg",
      channel_id: "ch-999",
      content: "hi",
    });

    await message.channel.send({
      content: "Sending file...",
      files: [{ name: "log.txt", data: Buffer.from("error log") }],
    });

    expect(capturedOptions.body).toBeInstanceOf(FormData);
    const formData = capturedOptions.body as FormData;
    expect(formData.has("files[0]")).toBe(true);
    expect(formData.has("payload_json")).toBe(true);

    client.destroy();
  });
});
