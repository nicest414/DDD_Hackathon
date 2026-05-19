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
                let parsed;
                try {
                    parsed = JSON.parse(payload);
                }
                catch (err) {
                    this.output.appendLine(`[DDD] Received invalid JSON: ${this._errorMessage(err)}; payload=${payload}`);
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
                Promise.resolve(this.onEvent?.(event)).catch((err) => {
                    this.output.appendLine(`[DDD] onEvent failed: ${this._errorMessage(err)}; eventType=${event.type}`);
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
    _validateIncomingEvent(event) {
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
                    project: project,
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
                    error: this._invalidEvent('swipe.action must be accepted or rejected.', event.projectId),
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
        return {
            error: this._invalidEvent('event.type must be startSession or swipe.'),
        };
    }
    _validateProject(project) {
        if (!this._isRecord(project)) {
            return 'startSession.project is required.';
        }
        const required = [
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
        if (project.status !== 'draft' &&
            project.status !== 'building' &&
            project.status !== 'generated' &&
            project.status !== 'failed') {
            return 'startSession.project.status is invalid.';
        }
        return null;
    }
    _sendError(ws, event) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
            this.output.appendLine(`[DDD] → error ${event.code}`);
        }
    }
    _invalidEvent(message, projectId) {
        return {
            type: 'error',
            projectId,
            code: 'INVALID_EVENT',
            message,
            recoverable: true,
        };
    }
    _isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
    _isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }
    _errorMessage(err) {
        return err instanceof Error ? err.message : String(err);
    }
}
exports.DDDWebSocketServer = DDDWebSocketServer;
//# sourceMappingURL=websocketServer.js.map