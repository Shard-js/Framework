import { EventEmitter } from "node:events";
import { Shard, ShardStatus } from "./Shard.js";
import type { WebSocketFactory } from "./ws/IWebSocket.js";
import type { RestClient } from "../rest/RestClient.js";
import { Endpoints } from "../rest/Endpoints.js";

export interface ShardManagerOptions {
  token: string;
  intents: number;
  totalShards?: number;
  shardIds?: number[];
  restClient?: RestClient;
  wsFactory?: WebSocketFactory;
}

export class ShardManager extends EventEmitter {
  public shards: Map<number, Shard> = new Map();
  private token: string;
  private intents: number;
  private totalShards?: number;
  private shardIds?: number[];
  private restClient?: RestClient;
  private wsFactory?: WebSocketFactory;

  constructor(options: ShardManagerOptions) {
    super();
    this.token = options.token;
    this.intents = options.intents;
    this.totalShards = options.totalShards;
    this.shardIds = options.shardIds;
    this.restClient = options.restClient;
    this.wsFactory = options.wsFactory;
  }

  public get ping(): number {
    let sum = 0;
    let count = 0;
    for (const shard of this.shards.values()) {
      if (shard.ping >= 0) {
        sum += shard.ping;
        count++;
      }
    }
    return count > 0 ? Math.round(sum / count) : -1;
  }

  public async connect(): Promise<void> {
    let total = this.totalShards;
    let gatewayUrl: string | undefined;

    if (!total && this.restClient) {
      try {
        const botData: any = await this.restClient.get(Endpoints.gatewayBot());
        total = botData.shards || 1;
        gatewayUrl = botData.url;
      } catch {
        total = 1;
      }
    }

    total = total || 1;
    const ids = this.shardIds || Array.from({ length: total }, (_, i) => i);

    for (const id of ids) {
      const shard = new Shard({
        id,
        totalShards: total,
        token: this.token,
        intents: this.intents,
        gatewayUrl,
        wsFactory: this.wsFactory,
      });

      this.setupShardListeners(shard);
      this.shards.set(id, shard);
      shard.connect();
    }
  }

  public disconnect(): void {
    for (const shard of this.shards.values()) {
      shard.disconnect();
    }
  }

  public destroy(): void {
    for (const shard of this.shards.values()) {
      shard.destroy();
    }
    this.shards.clear();
    this.removeAllListeners();
  }

  private setupShardListeners(shard: Shard): void {
    shard.on("dispatch", (event, data) => {
      this.emit("dispatch", event, data, shard.id);
      this.emit(event, data, shard.id);
    });

    shard.on("ready", (ready) => {
      this.emit("shardReady", shard.id, ready);
    });

    shard.on("resumed", () => {
      this.emit("shardResumed", shard.id);
    });

    shard.on("close", (code, reason, recoverable) => {
      this.emit("shardClose", shard.id, code, reason, recoverable);
    });

    shard.on("error", (err) => {
      this.emit("shardError", shard.id, err);
    });

    shard.on("fatal", (err) => {
      this.emit("fatal", err);
    });
  }
}
