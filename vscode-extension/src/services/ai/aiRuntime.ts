import { DecisionCard, Decision, GeneratedApp, Project } from '../../models/types';

export type AIRuntimeProvider = 'openai-compatible' | 'codex-cli' | 'claude-code' | 'baseline';
export type AIRuntimeConnectionErrorKind =
  'authentication'
  | 'timeout'
  | 'invalid-response'
  | 'configuration'
  | 'unavailable'
  | 'unknown';

export interface AIRuntimeConnectionResult {
  ok: boolean;
  provider: AIRuntimeProvider;
  message: string;
  errorKind?: AIRuntimeConnectionErrorKind;
  detail?: string;
}

export interface AIRuntimeAdapter {
  generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
    existingCards?: DecisionCard[],
  ): Promise<DecisionCard | null>;

  generateApp(project: Project, acceptedCards: DecisionCard[]): Promise<GeneratedApp>;

  testConnection(provider: AIRuntimeProvider): Promise<AIRuntimeConnectionResult>;
}

export class AIRuntimeAdapterError extends Error {}

export class AIRuntimeConnectionError extends AIRuntimeAdapterError {
  constructor(
    readonly kind: AIRuntimeConnectionErrorKind,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function maskSensitiveError(value: string | undefined): string | undefined {
  if (!value) { return value; }
  return value
    .replace(/(api[_-]?key["'\s:=]+)([^"'\s,]+)/gi, '$1[REDACTED]')
    .replace(/(authorization["'\s:=]+bearer\s+)([^"'\s,]+)/gi, '$1[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, '[REDACTED]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{8,})\b/g, '[REDACTED]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{8,})\b/g, '[REDACTED]');
}

export function classifyAIRuntimeError(err: unknown): AIRuntimeConnectionError {
  if (err instanceof AIRuntimeConnectionError) {
    return new AIRuntimeConnectionError(err.kind, err.message, maskSensitiveError(err.detail));
  }

  const error = err as { status?: number; code?: string; message?: string; name?: string };
  const message = error?.message ?? String(err);
  const normalized = message.toLowerCase();
  const detail = maskSensitiveError(message);

  if (error?.status === 401 || error?.status === 403 || normalized.includes('unauthorized') || normalized.includes('api key')) {
    return new AIRuntimeConnectionError('authentication', 'AI authentication failed. Check your API key or CLI login state.', detail);
  }
  if (error?.code === 'ETIMEDOUT' || error?.code === 'ABORT_ERR' || normalized.includes('timeout') || normalized.includes('timed out')) {
    return new AIRuntimeConnectionError('timeout', 'AI connection timed out. Check the network, provider status, or timeout setting.', detail);
  }
  if (normalized.includes('invalid json') || normalized.includes('no json') || normalized.includes('incomplete json') || normalized.includes('missing required field')) {
    return new AIRuntimeConnectionError('invalid-response', 'AI responded, but the response format was invalid.', detail);
  }
  if (normalized.includes('enoent') || normalized.includes('command not found') || normalized.includes('not found')) {
    return new AIRuntimeConnectionError('configuration', 'AI runtime command was not found. Check the provider installation and PATH.', detail);
  }
  if (error?.status && error.status >= 500) {
    return new AIRuntimeConnectionError('unavailable', 'AI provider is currently unavailable.', detail);
  }
  if (error?.status && error.status >= 400) {
    return new AIRuntimeConnectionError('configuration', 'AI provider rejected the request. Check the model, base URL, and provider settings.', detail);
  }

  return new AIRuntimeConnectionError('unknown', 'AI connection test failed.', detail);
}

export function extractFirstJsonObject(text: string, source: string): string {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new AIRuntimeAdapterError(`No JSON found in ${source} output: ${text.slice(0, 200)}`);
  }
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
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

  async testConnection(provider: AIRuntimeProvider): Promise<AIRuntimeConnectionResult> {
    try {
      const text = await this.callAI(
        'Return only this JSON object and no markdown: {"ok":true,"message":"connected"}',
      );
      const parsed = this.parseJson(text);
      if (parsed['ok'] !== true) {
        throw new AIRuntimeConnectionError(
          'invalid-response',
          'AI responded, but the response did not confirm connectivity.',
          maskSensitiveError(JSON.stringify(parsed).slice(0, 200)),
        );
      }
      return {
        ok: true,
        provider,
        message: 'AI connection test succeeded.',
      };
    } catch (err) {
      const classified = classifyAIRuntimeError(err);
      // Detail is masked in classifyAIRuntimeError for every error kind before it reaches UI/log callers.
      return {
        ok: false,
        provider,
        message: classified.message,
        errorKind: classified.kind,
        detail: classified.detail,
      };
    }
  }

  async generateNextCard(
    project: Project,
    _decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
    existingCards: DecisionCard[] = [],
  ): Promise<DecisionCard | null> {
    const pending = existingCards.filter(
      (card) => !accepted.some((acceptedCard) => acceptedCard.id === card.id)
        && !rejected.some((rejectedCard) => rejectedCard.id === card.id),
    );
    const prompt =
      `You are an AI assistant helping design a mobile app.\n` +
      `Project: "${project.title}"\n` +
      `Initial prompt: "${project.initialPrompt}"\n` +
      `Accepted features:\n${accepted.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n` +
      `Rejected features:\n${rejected.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n\n` +
      `Already suggested but not decided yet:\n${pending.map((c) => `- ${c.title}: ${c.description} (payoff: ${c.payoff})`).join('\n') || 'none'}\n\n` +
      `Do not repeat accepted, rejected, or already suggested ideas.\n` +
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
