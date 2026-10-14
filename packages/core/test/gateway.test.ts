import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import { Shard, ShardStatus } from "../src/discord/gateway/Shard.js";
import { GatewayOpcodes, GatewayCloseCodes } from "../src/discord/types/gateway.js";

describe("Gateway Shard & Protocol", () => {
  let wss: WebSocketServer;
  let wsPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => {
      wss.on("listening", () => {
        const addr = wss.address() as any;
        wsPort = addr.port;
        wsUrl = `ws://127.0.0.1:${wsPort}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => wss.close(resolve));
  });

  it("completes HELLO -> IDENTIFY -> READY handshake", async () => {
    let identified = false;

    wss.once("connection", (socket) => {
      socket.send(
        JSON.stringify({
          op: GatewayOpcodes.Hello,
          d: { heartbeat_interval: 500 },
        })
      );

      socket.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.op === GatewayOpcodes.Identify) {
          identified = true;
          expect(msg.d.token).toBe("test_token");
          expect(msg.d.intents).toBe(513);

          socket.send(
            JSON.stringify({
              op: GatewayOpcodes.Dispatch,
              s: 1,
              t: "READY",
              d: {
                v: 10,
                user: { id: "12345", username: "TestBot", discriminator: "0000" },
                guilds: [],
                session_id: "test_session_id",
                resume_gateway_url: wsUrl,
              },
            })
          );
        }
      });
    });

    const shard = new Shard({
      id: 0,
      totalShards: 1,
      token: "test_token",
      intents: 513,
      gatewayUrl: wsUrl,
    });

    await new Promise<void>((resolve) => {
      shard.on("ready", (ready) => {
        expect(ready.session_id).toBe("test_session_id");
        expect(shard.status).toBe(ShardStatus.Connected);
        expect(identified).toBe(true);
        shard.disconnect();
        resolve();
      });
      shard.connect();
    });
  });

  it("handles Heartbeat and Heartbeat ACK (Opcode 1 & 11)", async () => {
    let heartbeatReceived = false;

    wss.once("connection", (socket) => {
      socket.send(
        JSON.stringify({
          op: GatewayOpcodes.Hello,
          d: { heartbeat_interval: 100 },
        })
      );

      socket.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.op === GatewayOpcodes.Heartbeat) {
          heartbeatReceived = true;
          socket.send(JSON.stringify({ op: GatewayOpcodes.HeartbeatAck }));
        }
      });
    });

    const shard = new Shard({
      id: 0,
      totalShards: 1,
      token: "test_token",
      intents: 1,
      gatewayUrl: wsUrl,
    });

    await new Promise<void>((resolve) => {
      shard.on("heartbeatAck", (ping) => {
        expect(heartbeatReceived).toBe(true);
        expect(ping).toBeGreaterThanOrEqual(0);
        shard.disconnect();
        resolve();
      });
      shard.connect();
    });
  });

  it("emits fatal on unrecoverable close code 4004 (Authentication Failed)", async () => {
    wss.once("connection", (socket) => {
      socket.close(GatewayCloseCodes.AuthenticationFailed, "Authentication failed.");
    });

    const shard = new Shard({
      id: 0,
      totalShards: 1,
      token: "invalid_token",
      intents: 1,
      gatewayUrl: wsUrl,
    });

    await new Promise<void>((resolve) => {
      shard.on("fatal", (err) => {
        expect(err.message).toContain("4004");
        shard.destroy();
        resolve();
      });
      shard.connect();
    });
  });
});
