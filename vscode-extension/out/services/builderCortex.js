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
const aiRuntime_1 = require("./aiRuntime");
class BuilderCortex {
    constructor(ws, ai, fallbackAI, store, output) {
        this.ws = ws;
        this.ai = ai;
        this.fallbackAI = fallbackAI;
        this.store = store;
        this.output = output;
        this.projects = new Map();
        this.decisions = new Map(); // keyed by projectId
        this.cards = new Map();
    }
    async handleSwipe(projectId, cardId, action, createdAt = new Date().toISOString()) {
        if (!this.projects.has(projectId)) {
            this.output.appendLine(`[DDD] Swipe ignored: project ${projectId} not found`);
            this.ws.send({
                type: 'error',
                projectId,
                code: 'PROJECT_NOT_FOUND',
                message: `Project ${projectId} was not found.`,
                recoverable: true,
            });
            return;
        }
        const list = this.decisions.get(projectId) ?? [];
        const projectCards = this.cards.get(projectId) ?? [];
        const swipedCard = projectCards.find((card) => card.id === cardId);
        if (!swipedCard) {
            this.output.appendLine(`[DDD] Swipe ignored: card ${cardId} not found for project ${projectId}`);
            this.ws.send({
                type: 'error',
                projectId,
                code: 'CARD_NOT_FOUND',
                message: `Card ${cardId} was not found for project ${projectId}.`,
                recoverable: true,
            });
            return;
        }
        const decision = {
            id: `d-${Date.now()}`,
            projectId,
            cardId,
            action,
            reason: '',
            createdAt,
        };
        const updatedList = list.filter((d) => d.cardId !== cardId);
        updatedList.push(decision);
        this.decisions.set(projectId, updatedList);
        swipedCard.status = action;
        await this.store.saveDecision(decision);
        await this.store.saveCard(swipedCard);
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
        await this.store.saveProject(project);
        let app;
        try {
            app = await this.ai.generateApp(project, accepted);
        }
        catch (err) {
            if (err instanceof aiRuntime_1.AIRuntimeAdapterError) {
                this.output.appendLine('[DDD] AI failed, using baseline');
                app = await this.fallbackAI.generateApp(project, accepted);
            }
            else {
                project.status = 'failed';
                await this.store.saveProject(project);
                this.output.appendLine('[DDD] App generation failed, marking project failed');
                throw err;
            }
        }
        await this.store.saveGeneratedApp(app);
        project.status = 'generated';
        await this.store.saveProject(project);
        this.output.appendLine('[DDD] App generated');
        return app;
    }
    startPreview() {
        const terminal = vscode.window.createTerminal('DDD Preview');
        terminal.sendText('npm run dev');
        terminal.show();
        // TODO: detect Vite port and send PreviewEvent to mobile
    }
    async registerProject(project) {
        this.projects.set(project.id, project);
        await this.store.saveProject(project);
        const [decisions, cards] = await Promise.all([
            this.store.getDecisions(project.id),
            this.store.getCards(project.id),
        ]);
        this.decisions.set(project.id, decisions);
        this.cards.set(project.id, cards);
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
        const accepted = allCards.filter((c) => decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
        const rejected = allCards.filter((c) => decisions.find((d) => d.cardId === c.id && d.action === 'rejected'));
        try {
            const card = await this.ai.generateNextCard(project, decisions, accepted, rejected);
            if (!card) {
                return null;
            }
            this.cards.get(projectId)?.push(card);
            await this.store.saveCard(card);
            return card;
        }
        catch (err) {
            if (fallback) {
                const card = await this.fallbackAI.generateNextCard(project, decisions, accepted, rejected);
                if (card) {
                    this.cards.get(projectId)?.push(card);
                    await this.store.saveCard(card);
                }
                return card;
            }
            throw err;
        }
    }
}
exports.BuilderCortex = BuilderCortex;
//# sourceMappingURL=builderCortex.js.map