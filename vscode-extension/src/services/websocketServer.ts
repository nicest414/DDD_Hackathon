import * as os from 'os';
import * as vscode from 'vscode';
import * as qrcode from 'qrcode-terminal';
import { WebSocketServer, WebSocket } from 'ws';
import { ErrorEvent, IncomingEvent, OutgoingEvent, Project } from '../models/types';

export class DDDWebSocketServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private output: vscode.OutputChannel;
  onEvent?: (event: IncomingEvent) => void | Promise<void>;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  start(port = 3000): void {
    if (this.wss) { return; }
    try {
      this.wss = new WebSocketServer({ host: '0.0.0.0', port });
    } catch (err) {
      this.wss = null;
      this.output.appendLine(`[DDD] Failed to start WebSocket server: ${this._errorMessage(err)}`);
      return;
    }
    this._printConnectionInfo(port);

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
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch (err) {
          this.output.appendLine(
            `[DDD] Received invalid JSON: ${this._errorMessage(err)}; payloadLength=${payload.length}; payload=<payload omitted>`,
          );
          this._sendError(ws, {
            type: 'error',
            code: 'INVALID_EVENT',
            message: 'Request body must be valid JSON.',
            recoverable: true,
          });
          return;
        }

        const validation = this._validateIncomingEvent(parsed);
        if ('error' in validation) {
          this.output.appendLine(`[DDD] Invalid event: ${validation.error.message}`);
          this._sendError(ws, validation.error);
          return;
        }

        const event = validation.event;

        this.output.appendLine(`[DDD] ← ${event.type}`);
        Promise.resolve().then(() => this.onEvent?.(event)).catch((err) => {
          this.output.appendLine(
            `[DDD] onEvent failed: ${this._errorMessage(err)}; eventType=${event.type}`,
          );
          this._sendError(ws, {
            type: 'error',
            projectId: 'projectId' in event ? event.projectId : event.project.id,
            code: 'UNKNOWN_ERROR',
            message: 'Failed to process event.',
            recoverable: true,
          });
        });
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

  private _validateIncomingEvent(
    event: unknown,
  ): { event: IncomingEvent } | { error: ErrorEvent } {
    if (!this._isRecord(event)) {
      return {
        error: this._invalidEvent('Event payload must be a JSON object.'),
      };
    }

    if (event.type === 'startSession') {
      const project = event.project;
      const projectError = this._validateProject(project);
      if (projectError) {
        return { error: this._invalidEvent(projectError) };
      }
      return {
        event: {
          type: 'startSession',
          project: project as Project,
        },
      };
    }

    if (event.type === 'swipe') {
      if (!this._isNonEmptyString(event.projectId)) {
        return { error: this._invalidEvent('swipe.projectId is required.') };
      }
      if (!this._isNonEmptyString(event.cardId)) {
        return {
          error: this._invalidEvent('swipe.cardId is required.', event.projectId),
        };
      }
      if (event.action !== 'accepted' && event.action !== 'rejected') {
        return {
          error: this._invalidEvent(
            'swipe.action must be accepted or rejected.',
            event.projectId,
          ),
        };
      }
      if (!this._isNonEmptyString(event.createdAt)) {
        return {
          error: this._invalidEvent('swipe.createdAt is required.', event.projectId),
        };
      }

      return {
        event: {
          type: 'swipe',
          projectId: event.projectId,
          cardId: event.cardId,
          action: event.action,
          createdAt: event.createdAt,
        },
      };
    }

    if (event.type === 'finish') {
      if (!this._isNonEmptyString(event.projectId)) {
        return { error: this._invalidEvent('finish.projectId is required.') };
      }
      return {
        event: {
          type: 'finishSession',
          projectId: event.projectId,
        },
      };
    }

    return {
      error: this._invalidEvent('event.type must be startSession, swipe, or finish.'),
    };
  }

  private _validateProject(project: unknown): string | null {
    if (!this._isRecord(project)) {
      return 'startSession.project is required.';
    }

    const required: Array<keyof Project> = [
      'id',
      'title',
      'initialPrompt',
      'status',
      'createdAt',
      'updatedAt',
    ];
    const missing = required.find((field) => !this._isNonEmptyString(project[field]));
    if (missing) {
      return `startSession.project.${missing} is required.`;
    }

    if (
      project.status !== 'draft' &&
      project.status !== 'building' &&
      project.status !== 'generated' &&
      project.status !== 'failed'
    ) {
      return 'startSession.project.status is invalid.';
    }

    return null;
  }

  private _sendError(ws: WebSocket, event: ErrorEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      this.output.appendLine(`[DDD] → error ${event.code}`);
    }
  }

  private _invalidEvent(message: string, projectId?: string): ErrorEvent {
    return {
      type: 'error',
      projectId,
      code: 'INVALID_EVENT',
      message,
      recoverable: true,
    };
  }

  private _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private _isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private _errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private _printConnectionInfo(port: number): void {
    const localIps = this._getLocalIPv4Addresses();
    this.output.appendLine(`[DDD] WebSocket server listening on 0.0.0.0:${port}`);
    this.output.appendLine(`[DDD] Local fallback URL: ws://localhost:${port}`);

    if (localIps.length === 0) {
      this.output.appendLine('[DDD] No local IPv4 address found. Connect this PC to Wi-Fi and restart the extension.');
      return;
    }

    const primaryUrl = `ws://${localIps[0]}:${port}`;
    this.output.appendLine(`[DDD] Scan this QR from the Flutter app: ${primaryUrl}`);
    qrcode.generate(primaryUrl, { small: true }, (qr) => {
      this.output.appendLine(qr);
    });

    if (localIps.length > 1) {
      this.output.appendLine('[DDD] Other local network URLs:');
      for (const ip of localIps.slice(1)) {
        this.output.appendLine(`[DDD]   ws://${ip}:${port}`);
      }
    }
  }

  private _getLocalIPv4Addresses(): string[] {
    const addresses: Array<{ address: string; interfaceName: string }> = [];
    for (const [interfaceName, entries] of Object.entries(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === 'IPv4' && !entry.internal && this._isPrivateIPv4(entry.address)) {
          addresses.push({ address: entry.address, interfaceName });
        }
      }
    }
    return addresses
      .sort((a, b) => this._interfaceScore(a.interfaceName) - this._interfaceScore(b.interfaceName))
      .map((entry) => entry.address);
  }

  private _isPrivateIPv4(address: string): boolean {
    return (
      address.startsWith('10.') ||
      address.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
    );
  }

  private _interfaceScore(interfaceName: string): number {
    if (/^(en|eth|wlan|wi-fi)/i.test(interfaceName)) { return 0; }
    if (/^(bridge|docker|vbox|vmnet|utun|awdl|llw)/i.test(interfaceName)) { return 2; }
    return 1;
  }
}
