"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDDWebSocketServer = void 0;
const ws_1 = require("ws");
class DDDWebSocketServer {
    constructor(output) {
        this.wss = null;
        this.client = null;
        this.output = output;
    }
    start(port = 3000) {
        if (this.wss) {
            return;
        }
        try {
            this.wss = new ws_1.WebSocketServer({ port });
        }
        catch (err) {
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
            if (this.client &&
                (this.client.readyState === ws_1.WebSocket.OPEN ||
                    this.client.readyState === ws_1.WebSocket.CONNECTING)) {
                this.client.close();
            }
            this.client = ws;
            this.output.appendLine('[DDD] Flutter client connected');
            ws.on('message', (raw) => {
                const payload = raw.toString();
                let event;
                try {
                    event = JSON.parse(payload);
                }
                catch (err) {
                    this.output.appendLine(`[DDD] Received invalid JSON: ${this._errorMessage(err)}; payload=${payload}`);
                    return;
                }
                this.output.appendLine(`[DDD] ← ${event.type}`);
                try {
                    this.onEvent?.(event);
                }
                catch (err) {
                    this.output.appendLine(`[DDD] onEvent failed: ${this._errorMessage(err)}; eventType=${event.type}`);
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
    send(event) {
        if (this.client?.readyState === ws_1.WebSocket.OPEN) {
            this.client.send(JSON.stringify(event));
            this.output.appendLine(`[DDD] → ${event.type}`);
        }
    }
    stop() {
        this.wss?.close();
        this.wss = null;
        this.client = null;
    }
    get isRunning() {
        return this.wss !== null;
    }
    _errorMessage(err) {
        return err instanceof Error ? err.message : String(err);
    }
}
exports.DDDWebSocketServer = DDDWebSocketServer;
//# sourceMappingURL=websocketServer.js.map