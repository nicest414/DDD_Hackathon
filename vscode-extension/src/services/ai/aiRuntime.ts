import { DecisionCard, Decision, GeneratedApp, Project } from '../../models/types';

export type AIRuntimeProvider = 'openai-compatible' | 'codex-cli' | 'claude-code' | 'baseline';

export interface AIRuntimeAdapter {
  generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard | null>;

  generateApp(project: Project, acceptedCards: DecisionCard[]): Promise<GeneratedApp>;
}

export class AIRuntimeAdapterError extends Error {}

export function extractFirstJsonObject(text: string, source: string): string {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new AIRuntimeAdapterError(`No JSON found in ${source} output: ${text.slice(0, 200)}`);
  }
  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') { depth++; }
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    throw new AIRuntimeAdapterError(`Incomplete JSON object in ${source} output: ${text.slice(0, 200)}`);
  }
  return text.slice(start, end + 1);
}

const CARD_TYPES = new Set<DecisionCard['type']>([
  'concept', 'feature', 'ui', 'flow', 'data', 'moment', 'reward', 'polish', 'risk',
]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AIRuntimeAdapterError(`Missing required field: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function coerceScore(value: unknown, fallback = 0.5): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) { return fallback; }
  return Math.min(1, Math.max(0, n));
}

export abstract class BaseAIAdapter implements AIRuntimeAdapter {
  protected abstract callAI(prompt: string): Promise<string>;
  protected abstract parseJson(text: string): Record<string, unknown>;

  async generateNextCard(
    project: Project,
    _decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard | null> {
    const prompt =
      `You are an AI assistant helping design a mobile app.\n` +
      `Project: "${project.title}"\n` +
      `Initial prompt: "${project.initialPrompt}"\n` +
      `Accepted features:\n${accepted.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n` +
      `Rejected features:\n${rejected.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n\n` +
      `Suggest the next most important feature card in JSON (no markdown):\n` +
      `{"type":"moment","title":"...","hook":"...","description":"...","payoff":"...","acceptLabel":"...","rejectLabel":"...","predictedReward":"...","noveltyScore":0.0,"effortScore":0.0,"dopamineScore":0.0}`;

    const text = await this.callAI(prompt);
    const parsed = this.parseJson(text);

    const rawType = optionalString(parsed['type'], 'feature');
    const type = CARD_TYPES.has(rawType as DecisionCard['type'])
      ? rawType as DecisionCard['type']
      : 'feature';
    const title = requiredString(parsed['title'], 'title');
    const description = requiredString(parsed['description'], 'description');
    const predictedReward = optionalString(parsed['predictedReward'], '');
    const hook = optionalString(parsed['hook'], title);
    const payoff = optionalString(parsed['payoff'], predictedReward || description);
    const acceptLabel = optionalString(parsed['acceptLabel'], 'これ欲しい');
    const rejectLabel = optionalString(parsed['rejectLabel'], '今はいらない');

    return {
      id: `card-${Date.now()}`,
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
      noveltyScore: coerceScore(parsed['noveltyScore']),
      effortScore: coerceScore(parsed['effortScore']),
      dopamineScore: coerceScore(parsed['dopamineScore']),
      status: 'pending',
    };
  }

  async generateApp(project: Project, accepted: DecisionCard[]): Promise<GeneratedApp> {
    const prompt =
      `Generate a minimal React app spec for: "${project.title}"\n` +
      `Using these accepted features:\n${accepted.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n\n` +
      `Return JSON (no markdown):\n` +
      `{"name":"...","summary":"...","screens":[{"name":"...","description":"..."}],"features":["..."]}`;

    const text = await this.callAI(prompt);
    const spec = this.parseJson(text);

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
