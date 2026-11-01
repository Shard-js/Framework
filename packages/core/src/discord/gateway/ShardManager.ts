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
  spawnDelayMs?: number;
}

export class ShardManager extends EventEmitter {
  public shards: Map<number, Shard> = new Map();
  private token: string;
  private intents: number;
  private totalShards?: number;
  private shardIds?: number[];
  private restClient?: RestClient;
  private wsFactory?: WebSocketFactory;
  private spawnDelayMs: number;
  private destroyed = false;

  constructor(options: ShardManagerOptions) {
    super();
    this.token = options.token;
    this.intents = options.intents;
    this.totalShards = options.totalShards;
    this.shardIds = options.shardIds;
    this.restClient = options.restClient;
    this.wsFactory = options.wsFactory;
    this.spawnDelayMs = options.spawnDelayMs ?? 5000;
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
    let maxConcurrency = 1;

    if (this.restClient) {
      try {
        const botData: any = await this.restClient.get(Endpoints.gatewayBot());
        if (!total) {
          total = botData.shards || 1;
        }
        gatewayUrl = botData.url;
        if (botData.session_start_limit?.max_concurrency) {
          maxConcurrency = botData.session_start_limit.max_concurrency;
        }
      } catch {
        if (!total) total = 1;
      }
    }

    total = total || 1;
    const ids = this.shardIds || Array.from({ length: total }, (_, i) => i);

    // Group shards into concurrency buckets: shard_id % max_concurrency
    const buckets = new Map<number, number[]>();
    for (const id of ids) {
      const bucketKey = id % maxConcurrency;
      const list = buckets.get(bucketKey) || [];
      list.push(id);
      buckets.set(bucketKey, list);
    }

    const connectShard = (id: number): Shard => {
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
      return shard;
    };

    const bucketPromises = Array.from(buckets.values()).map(async (bucketShardIds) => {
      for (let i = 0; i < bucketShardIds.length; i++) {
        if (this.destroyed) break;
        const id = bucketShardIds[i];
        connectShard(id);
        if (i < bucketShardIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, this.spawnDelayMs));
        }
      }
    });

    await Promise.all(bucketPromises);
  }

  public disconnect(): void {
    for (const shard of this.shards.values()) {
      shard.disconnect();
    }
  }

  public destroy(): void {
    this.destroyed = true;
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
