"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuilderCortex = void 0;
const vscode = __importStar(require("vscode"));
const aiAdapter_1 = require("./aiAdapter");
class BuilderCortex {
    constructor(ws, ai, baseline, store, output) {
        this.ws = ws;
        this.ai = ai;
        this.baseline = baseline;
        this.store = store;
        this.output = output;
        this.projects = new Map();
        this.decisions = new Map(); // keyed by projectId
        this.cards = new Map();
    }
    async handleSwipe(projectId, cardId, action) {
        if (!this.projects.has(projectId)) {
            this.output.appendLine(`[DDD] Swipe ignored: project ${projectId} not found`);
            return;
        }
        const list = this.decisions.get(projectId) ?? [];
        const projectCards = this.cards.get(projectId) ?? [];
        if (!projectCards.find((card) => card.id === cardId)) {
            this.output.appendLine(`[DDD] Swipe ignored: card ${cardId} not found for project ${projectId}`);
            return;
        }
        const decision = {
            id: `d-${Date.now()}`,
            cardId,
            action,
            reason: '',
            createdAt: new Date().toISOString(),
        };
        list.push(decision);
        this.decisions.set(projectId, list);
        this.store.saveDecision(decision);
        this.output.appendLine(`[DDD] Decision: ${action} → ${cardId}`);
        // Generate next card
        const nextCard = await this._nextCard(projectId);
        if (nextCard) {
            this.ws.send({ type: 'card', card: nextCard });
        }
    }
    async generateApp(projectId) {
        const project = this.projects.get(projectId);
        if (!project) {
            vscode.window.showErrorMessage(`DDD: Project ${projectId} not found`);
            return undefined;
        }
        const decisions = this.decisions.get(projectId) ?? [];
        const allCards = this.cards.get(projectId) ?? [];
        const accepted = allCards.filter((c) => decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
        this.output.appendLine('[DDD] Generating app...');
        project.status = 'building';
        this.store.saveProject(project);
        let app;
        try {
            app = await this.ai.generateApp(project, accepted);
        }
        catch (err) {
            if (err instanceof aiAdapter_1.AIAdapterError) {
                this.output.appendLine('[DDD] AI failed, using baseline');
                app = this.baseline.getMockApp(projectId);
            }
            else {
                project.status = 'failed';
                this.store.saveProject(project);
                this.output.appendLine('[DDD] App generation failed, marking project failed');
                throw err;
            }
        }
        this.store.saveGeneratedApp(app);
        project.status = 'generated';
        this.store.saveProject(project);
        this.output.appendLine('[DDD] App generated');
        return app;
    }
    startPreview() {
        const terminal = vscode.window.createTerminal('DDD Preview');
        terminal.sendText('npm run dev');
        terminal.show();
        // TODO: detect Vite port and send PreviewEvent to mobile
    }
    registerProject(project) {
        this.projects.set(project.id, project);
        this.store.saveProject(project);
        this.decisions.set(project.id, []);
        this.cards.set(project.id, []);
    }
    async _nextCard(projectId) {
        const project = this.projects.get(projectId);
        const decisions = this.decisions.get(projectId) ?? [];
        const allCards = this.cards.get(projectId) ?? [];
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        const fallback = cfg.get('fallbackEnabled') ?? true;
        if (!project) {
            return null;
        }
        try {
            const accepted = allCards.filter((c) => decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
            const rejected = allCards.filter((c) => decisions.find((d) => d.cardId === c.id && d.action === 'rejected'));
            const card = await this.ai.generateNextCard(project, decisions, accepted, rejected);
            this.cards.get(projectId)?.push(card);
            this.store.saveCard(card);
            return card;
        }
        catch (err) {
            if (fallback) {
                const card = this.baseline.getNextCard(projectId, decisions);
                if (card) {
                    this.cards.get(projectId)?.push(card);
                    this.store.saveCard(card);
                }
                return card;
            }
            throw err;
        }
    }
}
exports.BuilderCortex = BuilderCortex;
//# sourceMappingURL=builderCortex.js.map