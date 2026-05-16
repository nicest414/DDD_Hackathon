import * as vscode from 'vscode';
import { Project, Decision, DecisionCard, GeneratedApp } from '../models/types';
import { AIAdapter, AIAdapterError } from './aiAdapter';
import { BaselineDopamine } from './baselineDopamine';
import { DDDWebSocketServer } from './websocketServer';
import { DecisionStore } from './decisionStore';

export class BuilderCortex {
  private projects = new Map<string, Project>();
  private decisions = new Map<string, Decision[]>(); // keyed by projectId
  private cards = new Map<string, DecisionCard[]>();

  constructor(
    private readonly ws: DDDWebSocketServer,
    private readonly ai: AIAdapter,
    private readonly baseline: BaselineDopamine,
    private readonly store: DecisionStore,
    private readonly output: vscode.OutputChannel,
  ) {}

  async handleSwipe(projectId: string, cardId: string, action: 'accepted' | 'rejected'): Promise<void> {
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

    const decision: Decision = {
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

  async generateApp(projectId: string): Promise<GeneratedApp | undefined> {
    const project = this.projects.get(projectId);
    if (!project) {
      vscode.window.showErrorMessage(`DDD: Project ${projectId} not found`);
      return undefined;
    }

    const decisions = this.decisions.get(projectId) ?? [];
    const allCards = this.cards.get(projectId) ?? [];
    const accepted = allCards.filter(
      (c) => decisions.find((d) => d.cardId === c.id && d.action === 'accepted'),
    );

    this.output.appendLine('[DDD] Generating app...');
    project.status = 'building';
    this.store.saveProject(project);

    let app;
    try {
      app = await this.ai.generateApp(project, accepted);
    } catch (err) {
      if (err instanceof AIAdapterError) {
        this.output.appendLine('[DDD] AI failed, using baseline');
        app = this.baseline.getMockApp(projectId);
      } else {
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

  startPreview(): void {
    const terminal = vscode.window.createTerminal('DDD Preview');
    terminal.sendText('npm run dev');
    terminal.show();
    // TODO: detect Vite port and send PreviewEvent to mobile
  }

  registerProject(project: Project): void {
    this.projects.set(project.id, project);
    this.store.saveProject(project);
    this.decisions.set(project.id, []);
    this.cards.set(project.id, []);
  }

  private async _nextCard(projectId: string): Promise<DecisionCard | null> {
    const project = this.projects.get(projectId);
    const decisions = this.decisions.get(projectId) ?? [];
    const allCards = this.cards.get(projectId) ?? [];

    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const fallback = cfg.get<boolean>('fallbackEnabled') ?? true;

    if (!project) { return null; }

    try {
      const accepted = allCards.filter((c) =>
        decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
      const rejected = allCards.filter((c) =>
        decisions.find((d) => d.cardId === c.id && d.action === 'rejected'));
      const card = await this.ai.generateNextCard(project, decisions, accepted, rejected);
      this.cards.get(projectId)?.push(card);
      this.store.saveCard(card);
      return card;
    } catch (err) {
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
