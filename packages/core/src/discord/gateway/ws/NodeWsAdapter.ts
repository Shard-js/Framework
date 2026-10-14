import WebSocket from "ws";
import type { IWebSocket, WebSocketFactory } from "./IWebSocket.js";

export class NodeWsAdapter implements IWebSocket {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  public on(event: "open", listener: () => void): this;
  public on(event: "message", listener: (data: string | Buffer) => void): this;
  public on(event: "close", listener: (code: number, reason: string) => void): this;
  public on(event: "error", listener: (error: Error) => void): this;
  public on(event: string, listener: (...args: any[]) => void): this {
    if (event === "close") {
      this.ws.on("close", (code, reasonBuf) => {
        listener(code, reasonBuf.toString("utf-8"));
      });
    } else {
      this.ws.on(event as any, listener);
    }
    return this;
  }

  public send(data: string | Buffer): void {
    this.ws.send(data);
  }

  public close(code?: number, reason?: string): void {
    this.ws.close(code, reason);
  }

  public terminate(): void {
    this.ws.terminate();
  }
}

export const defaultWebSocketFactory: WebSocketFactory = (url: string) => {
  return new NodeWsAdapter(url);
};
