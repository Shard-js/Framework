
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
