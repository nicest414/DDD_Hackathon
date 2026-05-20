import * as vscode from 'vscode';
import OpenAI from 'openai';
import { DecisionCard, Decision, GeneratedApp, Project } from '../models/types';
import { AIRuntimeAdapter, AIRuntimeAdapterError, AIRuntimeProvider } from './aiRuntime';
import { BaselineDopamine } from './baselineDopamine';

const cardTypes = new Set<DecisionCard['type']>([
  'concept',
  'feature',
  'ui',
  'flow',
  'data',
  'moment',
  'reward',
  'polish',
  'risk',
]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AIRuntimeAdapterError(`AI response is missing required field: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function coerceScore(value: unknown, fallback = 0.5): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) { return fallback; }
  return Math.min(1, Math.max(0, numeric));
}

export class OpenAICompatibleAdapter implements AIRuntimeAdapter {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private async client(): Promise<OpenAI> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const apiKey = await this.context.secrets.get('ddd.apiKey');
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new AIRuntimeAdapterError('DDD API key is required');
    }
    return new OpenAI({
      baseURL: cfg.get<string>('baseUrl'),
      apiKey: apiKey.trim(),
      timeout: cfg.get<number>('timeoutMs') ?? 30000,
    });
  }

  async generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const model = cfg.get<string>('model') ?? 'gpt-4o-mini';
    const maxTokens = cfg.get<number>('maxTokens') ?? 2000;

    const prompt = `
You are an AI assistant helping design a mobile app.
Project: "${project.title}"
Initial prompt: "${project.initialPrompt}"
Accepted features: ${accepted.map((c) => c.title).join(', ') || 'none'}
Rejected features: ${rejected.map((c) => c.title).join(', ') || 'none'}

Suggest the next most important feature card in JSON:
{
  "type": "moment",
  "title": "...",
  "hook": "...",
  "description": "...",
  "payoff": "...",
  "acceptLabel": "...",
  "rejectLabel": "...",
  "predictedReward": "...",
  "noveltyScore": 0.0-1.0,
  "effortScore": 0.0-1.0,
  "dopamineScore": 0.0-1.0
}
Only output JSON, no markdown.`;

    const client = await this.client();
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.choices[0]?.message?.content ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON from AI: ${text}`);
    }

    const rawType = optionalString(parsed['type'], 'feature');
    const type = cardTypes.has(rawType as DecisionCard['type'])
      ? rawType as DecisionCard['type']
      : 'feature';
    const title = requiredString(parsed['title'], 'title');
    const description = requiredString(parsed['description'], 'description');
    const predictedReward = optionalString(parsed['predictedReward'], '');
    const hook = optionalString(parsed['hook'], title) || title;
    const payoff = optionalString(parsed['payoff'], predictedReward || description) || predictedReward || description;
    const acceptLabel = optionalString(parsed['acceptLabel'], 'これ欲しい') || 'これ欲しい';
    const rejectLabel = optionalString(parsed['rejectLabel'], '今はいらない') || '今はいらない';
    const noveltyScore = coerceScore(parsed['noveltyScore']);
    const effortScore = coerceScore(parsed['effortScore']);
    const dopamineScore = coerceScore(parsed['dopamineScore']);

    return {
      id: `ai-${Date.now()}`,
      projectId: project.id,
      type,
      title,
      hook,
      description,
      payoff,
      acceptLabel,
      rejectLabel,
      payload: {},
      predictedReward,
      noveltyScore,
      effortScore,
      dopamineScore,
      status: 'pending',
    };
  }

  async generateApp(project: Project, accepted: DecisionCard[]): Promise<GeneratedApp> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const model = cfg.get<string>('model') ?? 'gpt-4o-mini';

    const prompt = `
Generate a minimal React app spec for: "${project.title}"
Using these accepted features: ${accepted.map((c) => c.title).join(', ')}

Return JSON:
{
  "name": "...",
  "summary": "...",
  "screens": [{"name":"...","description":"..."}],
  "features": ["..."]
}
Only output JSON.`;

    const client = await this.client();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.choices[0]?.message?.content ?? '';
    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(text);
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON from AI: ${text}`);
    }

    return {
      id: `app-${project.id}`,
      projectId: project.id,
      spec,
      source: '// TODO: code generation',
      previewState: {},
      repositoryUrl: '',
      branchName: '',
      pullRequestUrl: '',
      updatedAt: new Date().toISOString(),
    };
  }
}

export class ConfiguredAIRuntimeAdapter implements AIRuntimeAdapter {
  private readonly openAI: OpenAICompatibleAdapter;

  constructor(
    context: vscode.ExtensionContext,
    private readonly baseline: BaselineDopamine,
  ) {
    this.openAI = new OpenAICompatibleAdapter(context);
  }

  async generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard | null> {
    return this.adapter().generateNextCard(project, decisions, accepted, rejected);
  }

  async generateApp(project: Project, acceptedCards: DecisionCard[]): Promise<GeneratedApp> {
    return this.adapter().generateApp(project, acceptedCards);
  }

  private adapter(): AIRuntimeAdapter {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const provider = cfg.get<AIRuntimeProvider>('provider') ?? 'openai-compatible';
    if (provider === 'baseline') {
      return this.baseline;
    }
    return this.openAI;
  }
}
