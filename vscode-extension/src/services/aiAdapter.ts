import * as vscode from 'vscode';
import OpenAI from 'openai';
import { DecisionCard, Decision, GeneratedApp, Project } from '../models/types';

export class AIAdapterError extends Error {}

const cardTypes = new Set<DecisionCard['type']>(['concept', 'feature', 'ui', 'flow', 'data']);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AIAdapterError(`AI response is missing required field: ${field}`);
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

export class AIAdapter {
  private client(): OpenAI {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const apiKey = process.env['DDD_API_KEY'];
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new AIAdapterError('DDD_API_KEY environment variable is required');
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
  "type": "feature",
  "title": "...",
  "description": "...",
  "predictedReward": "...",
  "noveltyScore": 0.0-1.0,
  "effortScore": 0.0-1.0
}
Only output JSON, no markdown.`;

    const res = await this.client().chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.choices[0]?.message?.content ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AIAdapterError(`Invalid JSON from AI: ${text}`);
    }

    const rawType = optionalString(parsed['type'], 'feature');
    const type = cardTypes.has(rawType as DecisionCard['type'])
      ? rawType as DecisionCard['type']
      : 'feature';
    const title = requiredString(parsed['title'], 'title');
    const description = requiredString(parsed['description'], 'description');
    const predictedReward = optionalString(parsed['predictedReward'], '');
    const noveltyScore = coerceScore(parsed['noveltyScore']);
    const effortScore = coerceScore(parsed['effortScore']);

    return {
      id: `ai-${Date.now()}`,
      projectId: project.id,
      type,
      title,
      description,
      payload: {},
      predictedReward,
      noveltyScore,
      effortScore,
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

    const res = await this.client().chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.choices[0]?.message?.content ?? '';
    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(text);
    } catch {
      throw new AIAdapterError(`Invalid JSON from AI: ${text}`);
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
