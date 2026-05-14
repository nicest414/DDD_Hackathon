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
    this.wss = new WebSocketServer({ port });
    this.output.appendLine(`[DDD] WebSocket server listening on ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      this.client = ws;
      this.output.appendLine('[DDD] Flutter client connected');

      ws.on('message', (raw) => {
        try {
          const event = JSON.parse(raw.toString()) as IncomingEvent;
          this.output.appendLine(`[DDD] ← ${event.type}`);
          this.onEvent?.(event);
        } catch {
          this.output.appendLine('[DDD] Received invalid JSON');
        }
      });

      ws.on('close', () => {
        this.client = null;
        this.output.appendLine('[DDD] Flutter client disconnected');
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
}
