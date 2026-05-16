import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingEvent, OutgoingEvent } from '../models/types';

export class DDDWebSocketServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private output: vscode.OutputChannel;
  onEvent?: (event: IncomingEvent) => void;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  start(port = 3000): void {
    if (this.wss) { return; }
    try {
      this.wss = new WebSocketServer({ port });
    } catch (err) {
      this.wss = null;
      this.output.appendLine(`[DDD] Failed to start WebSocket server: ${this._errorMessage(err)}`);
      return;
    }
    this.output.appendLine(`[DDD] WebSocket server listening on ws://localhost:${port}`);

    this.wss.on('error', (err) => {
      this.output.appendLine(`[DDD] WebSocket server error: ${this._errorMessage(err)}`);
      const server = this.wss;
      this.wss = null;
      this.client = null;
      server?.close();
    });

    this.wss.on('connection', (ws) => {
      if (
        this.client &&
        (this.client.readyState === WebSocket.OPEN ||
          this.client.readyState === WebSocket.CONNECTING)
      ) {
        this.client.close();
      }
      this.client = ws;
      this.output.appendLine('[DDD] Flutter client connected');

      ws.on('message', (raw) => {
        const payload = raw.toString();
        try {
          const event = JSON.parse(payload) as IncomingEvent;
          this.output.appendLine(`[DDD] ← ${event.type}`);
          this.onEvent?.(event);
        } catch (err) {
          this.output.appendLine(
            `[DDD] Received invalid JSON: ${this._errorMessage(err)}; payload=${payload}`,
          );
        }
      });

      ws.on('close', () => {
        if (this.client === ws) {
          this.client = null;
        }
        this.output.appendLine('[DDD] Flutter client disconnected');
      });

      ws.on('error', (err) => {
        if (this.client === ws) {
          this.client = null;
        }
        this.output.appendLine(`[DDD] Flutter client error: ${this._errorMessage(err)}`);
      });
    });
  }

  send(event: OutgoingEvent): void {
    if (this.client?.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify(event));
      this.output.appendLine(`[DDD] → ${event.type}`);
    }
  }

  stop(): void {
    this.wss?.close();
    this.wss = null;
    this.client = null;
  }

  get isRunning(): boolean {
    return this.wss !== null;
  }

  private _errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
