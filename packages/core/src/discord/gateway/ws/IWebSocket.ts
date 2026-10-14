/**
 * WebSocket Abstraction Interface.
 * Allows swapping between 'ws' (pinned for Node 18/20 LTS) and native global WebSocket or mock implementations.
 */

export interface IWebSocket {
  on(event: "open", listener: () => void): this;
  on(event: "message", listener: (data: string | Buffer) => void): this;
  on(event: "close", listener: (code: number, reason: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
}

export type WebSocketFactory = (url: string) => IWebSocket;
