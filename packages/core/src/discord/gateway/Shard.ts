import { EventEmitter } from "node:events";
import {
  GatewayOpcodes,
  GatewayCloseCodes,
  isRecoverableCloseCode,
  type GatewayPayload,
  type GatewayHelloData,
  type GatewayReadyData,
  type GatewayIdentifyData,
  type GatewayResumeData,
} from "../types/gateway.js";
import type { IWebSocket, WebSocketFactory } from "./ws/IWebSocket.js";
import { defaultWebSocketFactory } from "./ws/NodeWsAdapter.js";

export enum ShardStatus {
  Disconnected = "DISCONNECTED",
  Connecting = "CONNECTING",
  WaitingHello = "WAITING_HELLO",
  Identifying = "IDENTIFYING",
  Resuming = "RESUMING",
  Connected = "CONNECTED",
  Reconnecting = "RECONNECTING",
  Destroyed = "DESTROYED",
}

export interface ShardOptions {
  id: number;
  totalShards: number;
  token: string;
  intents: number;
  gatewayUrl?: string;
  wsFactory?: WebSocketFactory;
}

export class Shard extends EventEmitter {
  public readonly id: number;
  public readonly totalShards: number;
  public status: ShardStatus = ShardStatus.Disconnected;
  public ping = -1;

  private token: string;
  private intents: number;
  private gatewayUrl: string;
  private wsFactory: WebSocketFactory;
  private ws: IWebSocket | null = null;

  public sessionId: string | null = null;
  public resumeGatewayUrl: string | null = null;
  public seq: number | null = null;

  private heartbeatInterval: number | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatAckReceived = true;
  private lastHeartbeatSentAt = 0;

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private invalidSessionTimer: NodeJS.Timeout | null = null;

  constructor(options: ShardOptions) {
    super();
    this.id = options.id;
    this.totalShards = options.totalShards;
    this.token = options.token;
    this.intents = options.intents;
    this.gatewayUrl = options.gatewayUrl || "wss://gateway.discord.gg/?v=10&encoding=json";
    this.wsFactory = options.wsFactory || defaultWebSocketFactory;
  }

  public connect(): void {
    if (this.status === ShardStatus.Destroyed) {
      throw new Error(`Cannot connect destroyed Shard ${this.id}`);
    }
    if (this.status === ShardStatus.Connected || this.status === ShardStatus.Connecting) {
      return;
    }

    this.clearTimers();
    this.status = ShardStatus.Connecting;

    const targetUrl =
      this.sessionId && this.resumeGatewayUrl
        ? `${this.resumeGatewayUrl}${this.resumeGatewayUrl.includes("?") ? "&" : "/?"}v=10&encoding=json`
        : this.gatewayUrl;

    try {
      this.ws = this.wsFactory(targetUrl);
    } catch (err: any) {
      this.emit("error", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.status = ShardStatus.WaitingHello;
      this.reconnectAttempts = 0;
      this.emit("wsOpen", this.id);
    });

    this.ws.on("message", (raw) => {
      this.handleMessage(raw);
    });

    this.ws.on("close", (code, reason) => {
      this.handleClose(code, reason);
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
  }

  public disconnect(code = 1000, reason = "Client disconnect"): void {
    this.clearTimers();
    this.status = ShardStatus.Disconnected;
    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {
        // Ignored
      }
      this.ws = null;
    }
  }

  public destroy(): void {
    this.disconnect();
    this.status = ShardStatus.Destroyed;
    this.removeAllListeners();
  }

  public send(payload: GatewayPayload): void {
    if (!this.ws || this.status === ShardStatus.Disconnected || this.status === ShardStatus.Destroyed) {
      return;
    }
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err: any) {
      this.emit("error", err);
    }
  }

  private handleMessage(rawData: string | Buffer): void {
    let payload: GatewayPayload;
    try {
      const text = typeof rawData === "string" ? rawData : rawData.toString("utf-8");
      payload = JSON.parse(text);
    } catch (err: any) {
      this.emit("error", new Error(`Shard ${this.id} failed to parse gateway payload: ${err.message}`));
      return;
    }

    if (payload.s !== undefined && payload.s !== null) {
      this.seq = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcodes.Hello:
        this.handleHello(payload.d as GatewayHelloData);
        break;

      case GatewayOpcodes.HeartbeatAck:
        this.heartbeatAckReceived = true;
        if (this.lastHeartbeatSentAt > 0) {
          this.ping = Date.now() - this.lastHeartbeatSentAt;
        }
        this.emit("heartbeatAck", this.ping);
        break;

      case GatewayOpcodes.Heartbeat:
        this.sendHeartbeat();
        break;

      case GatewayOpcodes.Reconnect:
        this.emit("debug", `[shard ${this.id}] Gateway requested Opcode 7 (Reconnect)`);
        this.reconnect(true);
        break;

      case GatewayOpcodes.InvalidSession:
        const resumable = Boolean(payload.d);
        this.emit("debug", `[shard ${this.id}] Gateway returned Opcode 9 (Invalid Session, resumable: ${resumable})`);
        if (!resumable) {
          this.sessionId = null;
          this.resumeGatewayUrl = null;
          this.seq = null;
        }
        this.invalidSessionTimer = setTimeout(() => {
          this.invalidSessionTimer = null;
          this.reconnect(resumable);
        }, Math.floor(Math.random() * 4000) + 1000);
        break;

      case GatewayOpcodes.Dispatch:
        this.handleDispatch(payload.t!, payload.d);
        break;
    }
  }

  private handleHello(data: GatewayHelloData): void {
    this.heartbeatInterval = data.heartbeat_interval;
    this.heartbeatAckReceived = true;

    const jitter = Math.floor(this.heartbeatInterval * Math.random());
    this.heartbeatTimer = setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, this.heartbeatInterval!);
    }, jitter);

    if (this.sessionId && this.seq !== null) {
      this.sendResume();
    } else {
      this.sendIdentify();
    }
  }

  private sendHeartbeat(): void {
    if (!this.heartbeatAckReceived) {
      this.emit(
        "debug",
        `[shard ${this.id}] Heartbeat ACK was not received. Zombied connection detected. Reconnecting...`
      );
      this.reconnect(true);
      return;
    }

    this.heartbeatAckReceived = false;
    this.lastHeartbeatSentAt = Date.now();
    this.send({
      op: GatewayOpcodes.Heartbeat,
      d: this.seq,
    });
  }

  private sendIdentify(): void {
    this.status = ShardStatus.Identifying;
    const identifyPayload: GatewayIdentifyData = {
      token: this.token,
      properties: {
        os: process.platform,
        browser: "shardjs",
        device: "shardjs",
      },
      intents: this.intents,
      shard: [this.id, this.totalShards],
    };

    this.send({
      op: GatewayOpcodes.Identify,
      d: identifyPayload,
    });
  }

  private sendResume(): void {
    this.status = ShardStatus.Resuming;
    const resumePayload: GatewayResumeData = {
      token: this.token,
      session_id: this.sessionId!,
      seq: this.seq!,
    };

    this.send({
      op: GatewayOpcodes.Resume,
      d: resumePayload,
    });
  }

  private handleDispatch(event: string, data: any): void {
    if (event === "READY") {
      const ready = data as GatewayReadyData;
      this.sessionId = ready.session_id;
      this.resumeGatewayUrl = ready.resume_gateway_url;
      this.status = ShardStatus.Connected;
      this.emit("ready", ready);
    } else if (event === "RESUMED") {
      this.status = ShardStatus.Connected;
      this.emit("resumed");
    }

    this.emit("dispatch", event, data);
  }

  private handleClose(code: number, reason: string): void {
    this.clearTimers();
    const recoverable = isRecoverableCloseCode(code);

    this.emit("close", code, reason, recoverable);

    if (this.status === ShardStatus.Destroyed) return;

    if (recoverable) {
      this.scheduleReconnect();
    } else {
      this.status = ShardStatus.Disconnected;
      this.emit(
        "fatal",
        new Error(
          `Shard ${this.id} closed with unrecoverable code ${code} (${reason || "No reason"}). Bot cannot reconnect.`
        )
      );
    }
  }

  private reconnect(resume = true): void {
    if (this.status === ShardStatus.Destroyed) return;
    if (!resume) {
      this.sessionId = null;
      this.resumeGatewayUrl = null;
      this.seq = null;
    }
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch {
        // Ignored
      }
      this.ws = null;
    }
    this.status = ShardStatus.Reconnecting;
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.status === ShardStatus.Destroyed) return;
    this.status = ShardStatus.Reconnecting;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5)), 30_000);

    this.emit("debug", `[shard ${this.id}] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.clearTimers();
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.invalidSessionTimer) {
      clearTimeout(this.invalidSessionTimer);
      this.invalidSessionTimer = null;
    }
  }
}
