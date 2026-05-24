import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { Project, Decision, DecisionCard, GeneratedApp } from '../models/types';
import { AIRuntimeAdapter, AIRuntimeAdapterError } from './ai/aiRuntime';
import { DDDWebSocketServer } from './websocketServer';
import { DecisionStore } from './decisionStore';
import { safePathToken } from './pathUtils';
import { DDD_GENERATED_APPS_DIR } from './githubPublisher';

const CARD_BATCH_SIZE = 3;
const CARD_QUEUE_REFILL_THRESHOLD = 3;

export class BuilderCortex {
  private projects = new Map<string, Project>();
  private decisions = new Map<string, Decision[]>(); // keyed by projectId
  private cards = new Map<string, DecisionCard[]>();
  private cardGenerationQueues = new Map<string, Promise<DecisionCard[]>>();
  private foregroundCardGenerationInFlight = new Map<string, boolean>();
  private cardQueues = new Map<string, DecisionCard[]>();
  private sentCardIds = new Map<string, Set<string>>();

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

    const nextCard = this._dequeueCard(projectId);
    if (nextCard) {
      this.ws.send({ type: 'card', card: nextCard });
      this._topUpCardsInBackground(projectId);
    } else {
      const queuedCards = await this._topUpCards(projectId, 1);
      const generatedNextCard = queuedCards.length > 0 ? this._dequeueCard(projectId) : null;
      if (generatedNextCard) {
        this.ws.send({ type: 'card', card: generatedNextCard });
        this._topUpCardsInBackground(projectId);
      }
    }

    if (this._cardQueue(projectId).length === 0 && this._pendingCards(projectId).length === 0) {
      this.ws.send({ type: 'complete', projectId });
      this.output.appendLine(`[DDD] Session complete: ${projectId}`);
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

  startPreview(projectId: string): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showWarningMessage('DDD: Open a workspace before opening preview.');
      return;
    }

    const safeProjectId = safePathToken(projectId);
    const generatedAppPath = path.join(workspacePath, DDD_GENERATED_APPS_DIR, safeProjectId, 'generated-app');
    if (!fs.existsSync(path.join(generatedAppPath, 'package.json'))) {
      vscode.window.showWarningMessage('DDD: Save locally before opening preview.');
      return;
    }

    const previewUrl = 'http://localhost:5173';
    const readyPattern = /(?:\bready\b|Local:|http:\/\/localhost:5173|Vite.*ready)/i;
    const command = this._previewCommand(generatedAppPath, workspacePath);
    const writeEmitter = new vscode.EventEmitter<string>();
    const closeEmitter = new vscode.EventEmitter<void | number>();
    let childProcess: ChildProcessWithoutNullStreams | undefined;

    const terminal = vscode.window.createTerminal({
      name: 'DDD Preview',
      pty: {
        onDidWrite: writeEmitter.event,
        onDidClose: closeEmitter.event,
        open: () => {
          let outputBuffer = '';
          let readySent = false;

          const forwardOutput = (data: Buffer | string): void => {
            const text = typeof data === 'string' ? data : data.toString('utf8');
            writeEmitter.fire(this._terminalOutputToText(text));
          };

          const handleOutput = (data: Buffer | string): void => {
            if (readySent) {
              return;
            }

            const text = typeof data === 'string' ? data : data.toString('utf8');
            outputBuffer = `${outputBuffer}${text}`.slice(-8192);
            if (!readyPattern.test(outputBuffer)) {
              return;
            }

            readySent = true;
            this.ws.send({ type: 'preview', projectId, url: previewUrl, status: 'ready' });
            childProcess?.stdout.removeListener('data', handleOutput);
            childProcess?.stderr.removeListener('data', handleOutput);
          };

          const shellCommand = process.platform === 'win32' ? 'cmd.exe' : 'sh';
          const shellArgs = process.platform === 'win32'
            ? ['/d', '/s', '/c', command]
            : ['-lc', command];

          childProcess = spawn(shellCommand, shellArgs, {
            cwd: generatedAppPath,
            env: process.env,
          });

          childProcess.stdout.on('data', forwardOutput);
          childProcess.stderr.on('data', forwardOutput);
          childProcess.stdout.on('data', handleOutput);
          childProcess.stderr.on('data', handleOutput);

          childProcess.once('error', (err) => {
            writeEmitter.fire(this._terminalOutputToText(`[DDD] Preview failed: ${this._errorMessage(err)}\n`));
            closeEmitter.fire();
          });

          childProcess.once('exit', (exitCode) => {
            childProcess?.stdout.removeListener('data', handleOutput);
            childProcess?.stderr.removeListener('data', handleOutput);
            closeEmitter.fire(exitCode ?? 1);
          });
        },
        close: () => {
          childProcess?.kill();
        },
      },
    });
    terminal.show();
    this.ws.send({ type: 'preview', projectId, url: previewUrl, status: 'starting' });
  }

  async handleStartSession(project: Project): Promise<void> {
    this.output.appendLine(`[DDD] Starting session: ${project.title} (${safePathToken(project.id)})`);
    await this.registerProject(project);
    await this.startProject(project);
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
    this.cardQueues.set(project.id, []);
  }

  async startProject(project: Project): Promise<void> {
    this.output.appendLine(`[DDD] Pregenerating ${CARD_BATCH_SIZE} cards for: ${project.title}`);
    this.sentCardIds.set(project.id, new Set<string>());
    this.cardQueues.set(project.id, []);
    await this._topUpCards(project.id, CARD_BATCH_SIZE);
    const firstCard = this._dequeueCard(project.id);
    if (firstCard) {
      this.ws.send({ type: 'card', card: firstCard });
      this.output.appendLine(`[DDD] First card sent: ${firstCard.title}`);
    }
  }

  private async _topUpCards(projectId: string, targetQueuedCount = CARD_BATCH_SIZE): Promise<DecisionCard[]> {
    if (targetQueuedCount <= 1) {
      if (this.foregroundCardGenerationInFlight.get(projectId)) {
        return this._cardQueue(projectId);
      }

      this.foregroundCardGenerationInFlight.set(projectId, true);
      try {
        return await this._generateCardsToFill(projectId, targetQueuedCount);
      } finally {
        this.foregroundCardGenerationInFlight.delete(projectId);
      }
    }

    const previous = this.cardGenerationQueues.get(projectId) ?? Promise.resolve([]);
    const next = previous
      .catch(() => [])
      .then(() => this._generateCardsToFill(projectId, targetQueuedCount));

    this.cardGenerationQueues.set(projectId, next);
    try {
      return await next;
    } finally {
      if (this.cardGenerationQueues.get(projectId) === next) {
        this.cardGenerationQueues.delete(projectId);
      }
    }
  }

  private _topUpCardsInBackground(projectId: string): void {
    if (this._cardQueue(projectId).length > CARD_QUEUE_REFILL_THRESHOLD) {
      return;
    }

    void this._topUpCards(projectId, CARD_BATCH_SIZE).catch((err) => {
      this.output.appendLine(`[DDD] Background card pregeneration failed: ${this._errorMessage(err)}`);
    });
  }

  private async _generateCardsToFill(projectId: string, targetQueuedCount: number): Promise<DecisionCard[]> {
    const queue = this._cardQueue(projectId);
    const sentIds = this._sentCardIds(projectId);
    const pendingCards = this._pendingCards(projectId).filter(
      (card) => !sentIds.has(card.id) && !queue.some((queuedCard) => queuedCard.id === card.id),
    );

    for (const card of pendingCards) {
      if (queue.length >= targetQueuedCount) { break; }
      queue.push(card);
    }

    const missing = Math.max(0, targetQueuedCount - queue.length);
    if (missing > 0) {
      const newCards = await this._generateCardBatch(projectId, missing);
      for (const card of newCards) {
        if (queue.length >= targetQueuedCount) { break; }
        if (sentIds.has(card.id)) { continue; }
        if (queue.some((queuedCard) => queuedCard.id === card.id)) { continue; }
        queue.push(card);
      }
    }

    return queue;
  }

  private async _generateCardBatch(projectId: string, count: number): Promise<DecisionCard[]> {
    const project = this.projects.get(projectId);
    const decisions = this.decisions.get(projectId) ?? [];
    const allCards = this.cards.get(projectId) ?? [];

    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const fallback = cfg.get<boolean>('fallbackEnabled') ?? true;

    if (!project) { return []; }

    const accepted = allCards.filter((c) =>
      decisions.find((d) => d.cardId === c.id && d.action === 'accepted'));
    const rejected = allCards.filter((c) =>
      decisions.find((d) => d.cardId === c.id && d.action === 'rejected'));

    try {
      const cards = await this.ai.generateCardBatch(project, decisions, accepted, rejected, allCards, count);
      return await this._saveGeneratedCards(projectId, cards);
    } catch (err) {
      this.output.appendLine(`[DDD] AI card batch generation failed: ${this._errorMessage(err)}`);
      if (fallback) {
        const cards = await this.fallbackAI.generateCardBatch(project, decisions, accepted, rejected, allCards, count);
        return await this._saveGeneratedCards(projectId, cards);
      }
      throw err;
    }
  }

  private async _saveGeneratedCards(projectId: string, cards: DecisionCard[]): Promise<DecisionCard[]> {
    const savedCards: DecisionCard[] = [];
    const knownIds = new Set((this.cards.get(projectId) ?? []).map((card) => card.id));
    for (const card of cards) {
      if (knownIds.has(card.id)) { continue; }
      await this.store.saveCard(card);
      knownIds.add(card.id);
      this.cards.get(projectId)?.push(card);
      savedCards.push(card);
    }
    return savedCards;
  }

  private _dequeueCard(projectId: string): DecisionCard | null {
    const card = this._cardQueue(projectId).shift() ?? null;
    if (card) {
      this._sentCardIds(projectId).add(card.id);
    }
    return card;
  }

  private _cardQueue(projectId: string): DecisionCard[] {
    let queue = this.cardQueues.get(projectId);
    if (!queue) {
      queue = [];
      this.cardQueues.set(projectId, queue);
    }
    return queue;
  }

  private _pendingCards(projectId: string): DecisionCard[] {
    const decisions = this.decisions.get(projectId) ?? [];
    const decidedIds = new Set(decisions.map((decision) => decision.cardId));
    return (this.cards.get(projectId) ?? []).filter((card) =>
      card.status === 'pending' && !decidedIds.has(card.id));
  }

  private _sentCardIds(projectId: string): Set<string> {
    let sentIds = this.sentCardIds.get(projectId);
    if (!sentIds) {
      sentIds = new Set<string>();
      this.sentCardIds.set(projectId, sentIds);
    }
    return sentIds;
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

  private _terminalOutputToText(text: string): string {
    return text.replace(/\r?\n/g, '\r\n');
  }

  private _previewCommand(generatedAppPath: string, workspacePath: string): string {
    const packageManager = this._previewPackageManager(generatedAppPath, workspacePath);
    switch (packageManager) {
      case 'pnpm':
        return 'pnpm install && pnpm dev';
      case 'yarn':
        return 'yarn install && yarn dev';
      case 'bun':
        return 'bun install && bun run dev';
      case 'npm':
      default:
        return 'npm install && npm run dev';
    }
  }

  private _previewPackageManager(generatedAppPath: string, workspacePath: string): 'npm' | 'pnpm' | 'yarn' | 'bun' {
    const configured = vscode.workspace.getConfiguration('ddd.preview').get<string>('packageManager') ?? 'auto';
    if (configured === 'npm' || configured === 'pnpm' || configured === 'yarn' || configured === 'bun') {
      return configured;
    }

    return this._packageManagerFromLockfile(generatedAppPath)
      ?? this._packageManagerFromLockfile(workspacePath)
      ?? 'npm';
  }

  private _packageManagerFromLockfile(directory: string): 'npm' | 'pnpm' | 'yarn' | 'bun' | undefined {
    if (fs.existsSync(path.join(directory, 'pnpm-lock.yaml'))) { return 'pnpm'; }
    if (fs.existsSync(path.join(directory, 'yarn.lock'))) { return 'yarn'; }
    if (fs.existsSync(path.join(directory, 'bun.lockb')) || fs.existsSync(path.join(directory, 'bun.lock'))) { return 'bun'; }
    if (fs.existsSync(path.join(directory, 'package-lock.json'))) { return 'npm'; }
    return undefined;
  }

}
