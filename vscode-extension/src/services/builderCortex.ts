import * as vscode from 'vscode';
import { Project, Decision, DecisionCard, GeneratedApp } from '../models/types';
import { AIRuntimeAdapter, AIRuntimeAdapterError } from './ai/aiRuntime';
import { DDDWebSocketServer } from './websocketServer';
import { DecisionStore } from './decisionStore';

export class BuilderCortex {
  private projects = new Map<string, Project>();
  private decisions = new Map<string, Decision[]>(); // keyed by projectId
  private cards = new Map<string, DecisionCard[]>();

  constructor(
    private readonly ws: DDDWebSocketServer,
    private readonly ai: AIRuntimeAdapter,
    private readonly fallbackAI: AIRuntimeAdapter,
    private readonly store: DecisionStore,
    private readonly output: vscode.OutputChannel,
  ) {}

  async handleSwipe(
    projectId: string,
    cardId: string,
    action: 'accepted' | 'rejected',
    createdAt = new Date().toISOString(),
  ): Promise<void> {
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

    const decision: Decision = {
      id: `d-${Date.now()}`,
      projectId,
      cardId,
      action,
      reason: '',
      createdAt,
    };

    const savedCard: DecisionCard = { ...swipedCard, status: action };
    try {
      await this.store.saveDecisionAndCard(decision, savedCard);
    } catch (err) {
      this.output.appendLine(
        `[DDD] Failed to persist swipe: ${this._errorMessage(err)}; projectId=${projectId}; cardId=${cardId}`,
      );
      throw err;
    }

    const updatedList = list.filter((d) => d.cardId !== cardId);
    updatedList.push(decision);
    this.decisions.set(projectId, updatedList);
    swipedCard.status = action;

    this.output.appendLine(`[DDD] Decision: ${action} → ${cardId}`);

    // Generate next card
    const nextCard = await this._nextCard(projectId);
    if (nextCard) {
      this.ws.send({ type: 'card', card: nextCard });
    }
  }

  async generateApp(projectId: string): Promise<GeneratedApp | undefined> {
    const project = this.projects.get(projectId);
    if (!project) {
      vscode.window.showErrorMessage(`DDD: Project ${projectId} not found`);
      return undefined;
    }

    const [decisions, allCards] = await Promise.all([
      this.store.getDecisions(projectId),
      this.store.getCards(projectId),
    ]);
    const accepted = allCards.filter(
      (c) => decisions.find((d) => d.cardId === c.id && d.action === 'accepted'),
    );

    this.output.appendLine('[DDD] Generating app...');
    project.status = 'building';
    await this.store.saveProject(project);

    let app;
    try {
      app = await this.ai.generateApp(project, accepted);
      app = { ...app, spec: this._normalizeSpec(app.spec, project) };
    } catch (err) {
      if (err instanceof AIRuntimeAdapterError) {
        this.output.appendLine(`[DDD] AI generateApp failed: ${this._errorMessage(err)}`);
        app = await this.fallbackAI.generateApp(project, accepted);
        app = { ...app, spec: this._normalizeSpec(app.spec, project) };
      } else {
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

  startPreview(): void {
    const terminal = vscode.window.createTerminal('DDD Preview');
    terminal.sendText('npm run dev');
    terminal.show();
    // TODO: detect Vite port and send PreviewEvent to mobile
  }

  async registerProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
    await this.store.saveProject(project);
    const [decisions, cards] = await Promise.all([
      this.store.getDecisions(project.id),
      this.store.getCards(project.id),
    ]);
    this.decisions.set(project.id, decisions);
    this.cards.set(project.id, cards);
  }

  async startProject(project: Project): Promise<void> {
    this.output.appendLine(`[DDD] Generating first card for: ${project.title}`);
    const firstCard = await this._nextCard(project.id);
    if (firstCard) {
      this.ws.send({ type: 'card', card: firstCard });
      this.output.appendLine(`[DDD] First card sent: ${firstCard.title}`);
    }
  }

  private async _nextCard(projectId: string): Promise<DecisionCard | null> {
    const project = this.projects.get(projectId);
    const decisions = this.decisions.get(projectId) ?? [];
    const allCards = this.cards.get(projectId) ?? [];

    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const fallback = cfg.get<boolean>('fallbackEnabled') ?? true;

    if (!project) { return null; }

    const accepted = allCards.filter((c) =>
      decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
    const rejected = allCards.filter((c) =>
      decisions.find((d) => d.cardId === c.id && d.action === 'rejected'));

    try {
      const card = await this.ai.generateNextCard(project, decisions, accepted, rejected);
      if (!card) { return null; }
      this.cards.get(projectId)?.push(card);
      await this.store.saveCard(card);
      return card;
    } catch (err) {
      this.output.appendLine(`[DDD] AI card generation failed: ${this._errorMessage(err)}`);
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

  private _normalizeSpec(spec: Record<string, unknown>, project: Project): Record<string, unknown> {
    return {
      name: typeof spec['name'] === 'string' && spec['name'] ? spec['name'] : project.title,
      summary: typeof spec['summary'] === 'string' && spec['summary'] ? spec['summary'] : project.initialPrompt,
      screens: Array.isArray(spec['screens']) ? spec['screens'] : [],
      features: Array.isArray(spec['features']) ? spec['features'] : [],
    };
  }

  private _errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
