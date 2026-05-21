import * as vscode from 'vscode';
import { DecisionCard, Decision, GeneratedApp, Project } from '../models/types';
import { AIRuntimeAdapter, AIRuntimeProvider } from './aiRuntime';
import { BaselineDopamine } from './baselineDopamine';
import { OpenAICompatibleAdapter } from './openaiAdapter';
import { CodexCLIAdapter } from './codexAdapter';
import { ClaudeCodeAdapter } from './claudeCodeAdapter';

export class AIRuntimeDispatcher implements AIRuntimeAdapter {
  private readonly openAI: OpenAICompatibleAdapter;
  private readonly codex: CodexCLIAdapter;
  private readonly claude: ClaudeCodeAdapter;

  constructor(
    context: vscode.ExtensionContext,
    private readonly baseline: BaselineDopamine,
  ) {
    this.openAI = new OpenAICompatibleAdapter(context);
    this.codex = new CodexCLIAdapter();
    this.claude = new ClaudeCodeAdapter();
  }

  async generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard | null> {
    return this.dispatch().generateNextCard(project, decisions, accepted, rejected);
  }

  async generateApp(project: Project, acceptedCards: DecisionCard[]): Promise<GeneratedApp> {
    return this.dispatch().generateApp(project, acceptedCards);
  }

  private dispatch(): AIRuntimeAdapter {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const provider = cfg.get<AIRuntimeProvider>('provider') ?? 'openai-compatible';
    if (provider === 'baseline') { return this.baseline; }
    if (provider === 'codex-cli') { return this.codex; }
    if (provider === 'claude-code') { return this.claude; }
    return this.openAI;
  }
}
