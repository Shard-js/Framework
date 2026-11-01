export interface MetricsSnapshot {
  uptime: number;
  gatewayPing: number;
  rateLimitHits: number;
  commands: {
    total: number;
    errors: number;
    byName: Record<string, number>;
  };
  memory?: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export interface MetricsCollectorOptions {
  collectMemory?: boolean;
}

export class MetricsCollector {
  private startTime = Date.now();
  private rateLimitHitsCount = 0;
  private commandsTotal = 0;
  private commandsErrors = 0;
  private commandsByName = new Map<string, number>();
  private clientGetter?: () => { ws?: { ping: number } } | undefined;
  private collectMemory: boolean;

  constructor(
    clientGetter?: () => { ws?: { ping: number } } | undefined,
    options: MetricsCollectorOptions = {}
  ) {
    this.clientGetter = clientGetter;
    this.collectMemory = options.collectMemory ?? true;
  }

  public recordRateLimit(routeKey?: string): void {
    this.rateLimitHitsCount++;
  }

  public recordCommand(commandName: string, durationMs?: number): void {
    this.commandsTotal++;
    const current = this.commandsByName.get(commandName) || 0;
    this.commandsByName.set(commandName, current + 1);
  }

  public recordCommandError(commandName: string, error?: any): void {
    this.commandsErrors++;
  }

  public get rateLimitHits(): number {
    return this.rateLimitHitsCount;
  }

  public get commandsExecuted(): number {
    return this.commandsTotal;
  }

  public get commandErrors(): number {
    return this.commandsErrors;
  }

  public get gatewayPing(): number {
    try {
      const client = this.clientGetter ? this.clientGetter() : undefined;
      return client?.ws?.ping ?? -1;
    } catch {
      return -1;
    }
  }

  public get uptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  public getSnapshot(): MetricsSnapshot {
    const memory =
      this.collectMemory && typeof process !== "undefined" && process.memoryUsage
        ? process.memoryUsage()
        : undefined;

    return {
      uptime: this.uptime,
      gatewayPing: this.gatewayPing,
      rateLimitHits: this.rateLimitHitsCount,
      commands: {
        total: this.commandsTotal,
        errors: this.commandsErrors,
        byName: Object.fromEntries(this.commandsByName.entries()),
      },
      ...(memory
        ? {
            memory: {
              heapUsed: memory.heapUsed,
              heapTotal: memory.heapTotal,
              rss: memory.rss,
            },
          }
        : {}),
    };
  }
}
