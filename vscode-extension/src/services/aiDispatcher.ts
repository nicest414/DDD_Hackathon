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
    private readonly output: vscode.OutputChannel,
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
    if (provider === 'baseline') {
      this.output.appendLine('[DDD] AI: baseline (mock)');
      return this.baseline;
    }
    if (provider === 'codex-cli') {
      this.output.appendLine('[DDD] AI: codex exec');
      return this.codex;
    }
    if (provider === 'claude-code') {
      this.output.appendLine('[DDD] AI: claude -p');
      return this.claude;
    }
    const model = cfg.get<string>('model') ?? '(not set)';
    const baseUrl = cfg.get<string>('baseUrl') ?? 'https://api.openai.com/v1';
    this.output.appendLine(`[DDD] AI: openai-compatible  model=${model}  url=${baseUrl}`);
    return this.openAI;
  }
}
