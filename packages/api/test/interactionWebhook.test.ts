import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import { ApiServer } from "../src/server.js";
import { verifyDiscordSignature } from "../src/crypto.js";

describe("P2.13: Discord Interaction Webhook receiver (serverless)", () => {
  let server: ApiServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  function createTestKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const rawPublicKeyHex = publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("hex");

    const sign = (body: string, timestamp: string): string => {
      const message = Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]);
      return crypto.sign(null, message, privateKey).toString("hex");
    };

    return { rawPublicKeyHex, sign };
  }

  it("verifyDiscordSignature validates correct signatures and rejects forged ones", () => {
    const { rawPublicKeyHex, sign } = createTestKeys();
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1700000000";
    const validSig = sign(body, timestamp);

    expect(verifyDiscordSignature(body, validSig, timestamp, rawPublicKeyHex)).toBe(true);

    // Tampered body
    expect(verifyDiscordSignature(body + "x", validSig, timestamp, rawPublicKeyHex)).toBe(false);

    // Tampered timestamp
    expect(verifyDiscordSignature(body, validSig, "1700000001", rawPublicKeyHex)).toBe(false);

    // Missing signature / timestamp
    expect(verifyDiscordSignature(body, null, timestamp, rawPublicKeyHex)).toBe(false);
    expect(verifyDiscordSignature(body, validSig, null, rawPublicKeyHex)).toBe(false);

    // Invalid signature length/content
    expect(verifyDiscordSignature(body, "deadbeef", timestamp, rawPublicKeyHex)).toBe(false);
  });

  it("handles PING (type 1) and responds with PONG (type 1)", async () => {
    const { rawPublicKeyHex, sign } = createTestKeys();

    server = new ApiServer({
      port: 0,
      interactionsPublicKey: rawPublicKeyHex,
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/interactions`;

    const body = JSON.stringify({ type: 1 });
    const timestamp = Date.now().toString();
    const signature = sign(body, timestamp);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature-Ed25519": signature,
        "X-Signature-Timestamp": timestamp,
      },
      body,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ type: 1 });
  });

  it("rejects forged or missing signature with 401 Unauthorized (fail-closed)", async () => {
    const { rawPublicKeyHex, sign } = createTestKeys();

    server = new ApiServer({
      port: 0,
      interactionsPublicKey: rawPublicKeyHex,
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/interactions`;

    const body = JSON.stringify({ type: 1 });
    const timestamp = Date.now().toString();
    const invalidSig = "0".repeat(128);

    // 1. Invalid signature
    const res1 = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature-Ed25519": invalidSig,
        "X-Signature-Timestamp": timestamp,
      },
      body,
    });
    expect(res1.status).toBe(401);

    // 2. Missing headers
    const res2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(res2.status).toBe(401);
  });

  it("forwards application command interactions to the onInteraction handler", async () => {
    const { rawPublicKeyHex, sign } = createTestKeys();
    const receivedInteractions: any[] = [];

    server = new ApiServer({
      port: 0,
      interactionsPublicKey: rawPublicKeyHex,
      onInteraction: async (interaction, res) => {
        receivedInteractions.push(interaction);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ type: 4, data: { content: "Pong from webhook!" } }));
      },
    });

    const { port, host } = await server.start();
    const url = `http://${host}:${port}/api/interactions`;

    const commandPayload = {
      type: 2, // ApplicationCommand
      id: "int-100",
      data: { name: "ping" },
    };
    const body = JSON.stringify(commandPayload);
    const timestamp = Date.now().toString();
    const signature = sign(body, timestamp);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature-Ed25519": signature,
        "X-Signature-Timestamp": timestamp,
      },
      body,
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ type: 4, data: { content: "Pong from webhook!" } });
    expect(receivedInteractions).toHaveLength(1);
    expect(receivedInteractions[0].id).toBe("int-100");
  });
});
