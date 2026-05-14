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
        this.wss = new ws_1.WebSocketServer({ port });
        this.output.appendLine(`[DDD] WebSocket server listening on ws://localhost:${port}`);
        this.wss.on('connection', (ws) => {
            this.client = ws;
            this.output.appendLine('[DDD] Flutter client connected');
            ws.on('message', (raw) => {
                try {
                    const event = JSON.parse(raw.toString());
                    this.output.appendLine(`[DDD] ← ${event.type}`);
                    this.onEvent?.(event);
                }
                catch {
                    this.output.appendLine('[DDD] Received invalid JSON');
                }
            });
            ws.on('close', () => {
                this.client = null;
                this.output.appendLine('[DDD] Flutter client disconnected');
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
}
exports.DDDWebSocketServer = DDDWebSocketServer;
//# sourceMappingURL=websocketServer.js.map