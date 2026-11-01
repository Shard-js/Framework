import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Shard, ShardStatus } from "../src/discord/gateway/Shard.js";
import type { IWebSocket } from "../src/discord/gateway/ws/IWebSocket.js";

class MockWebSocket extends EventEmitter implements IWebSocket {
  public sentData: string[] = [];
  public closed = false;
  public terminated = false;

  public send(data: string | Buffer): void {
    this.sentData.push(data.toString());
  }

  public close(): void {
    this.closed = true;
    this.emit("close", 1000, "Normal");
  }

  public terminate(): void {
    this.terminated = true;
    this.emit("close", 1006, "Abnormal closure");
  }
}

describe("Gateway Reconnect Race & State Machine Guard (P1 Issue #4)", () => {
  it("does not spawn a second socket when already in WaitingHello, Identifying or Resuming state", () => {
    let socketCount = 0;
    const sockets: MockWebSocket[] = [];

    const fakeFactory = () => {
      socketCount++;
      const s = new MockWebSocket();
      sockets.push(s);
      return s;
    };

    const shard = new Shard({
      id: 0,
      totalShards: 1,
      token: "test-token",
      intents: 1,
      wsFactory: fakeFactory as any,
    });

    shard.connect();
    expect(socketCount).toBe(1);

    // Socket connects and transitions to WaitingHello
    sockets[0].emit("open");
    expect(shard.status).toBe(ShardStatus.WaitingHello);

    // Call connect() again while in WaitingHello
    shard.connect();
    expect(socketCount).toBe(1); // Must still be 1!

    // Transition to Identifying
    shard.status = ShardStatus.Identifying;
    shard.connect();
    expect(socketCount).toBe(1); // Must still be 1!

    // Transition to Resuming
    shard.status = ShardStatus.Resuming;
    shard.connect();
    expect(socketCount).toBe(1); // Must still be 1!

    shard.destroy();
  });

  it("cleans up old socket listeners on reconnect so terminate() does not trigger duplicate scheduleReconnect()", () => {
    let socketCount = 0;
    const sockets: MockWebSocket[] = [];

    const fakeFactory = () => {
      socketCount++;
      const s = new MockWebSocket();
      sockets.push(s);
      return s;
    };

    const shard = new Shard({
      id: 0,
      totalShards: 1,
      token: "test-token",
      intents: 1,
      wsFactory: fakeFactory as any,
    });

    shard.connect();
    expect(socketCount).toBe(1);
    sockets[0].emit("open");

    const scheduleReconnectSpy = vi.spyOn(shard as any, "scheduleReconnect");

    // Trigger reconnect()
    (shard as any).reconnect(true);

    // A second socket is created for the reconnect
    expect(socketCount).toBe(2);

    // The first socket was terminated
    expect(sockets[0].terminated).toBe(true);

    // Crucially: sockets[0]'s close event must NOT have triggered scheduleReconnect!
    expect(scheduleReconnectSpy).not.toHaveBeenCalled();

    shard.destroy();
  });
});
