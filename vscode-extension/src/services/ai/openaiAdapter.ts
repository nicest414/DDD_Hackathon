import * as vscode from 'vscode';
import OpenAI from 'openai';
import { AIRuntimeAdapterError, BaseAIAdapter } from './aiRuntime';

export class OpenAICompatibleAdapter extends BaseAIAdapter {
  constructor(private readonly context: vscode.ExtensionContext) {
    super();
  }

  private async client(): Promise<OpenAI> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const apiKey = await this.context.secrets.get('ddd.apiKey');
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new AIRuntimeAdapterError('DDD API key is required');
    }
    const baseURL = (await this.context.secrets.get('ddd.baseUrl')) ?? 'https://api.openai.com/v1';
    return new OpenAI({
      baseURL,
      apiKey: apiKey.trim(),
      timeout: cfg.get<number>('timeoutMs') ?? 30000,
    });
  }

  protected async callAI(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const model = (await this.context.secrets.get('ddd.model')) ?? 'gpt-4o-mini';
    const maxTokens = cfg.get<number>('maxTokens') ?? 2000;

    const client = await this.client();
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0]?.message?.content ?? '';
  }

  protected parseJson(text: string): Record<string, unknown> {
    const json = text.trim();
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON from AI: ${json.slice(0, 200)}`);
    }
  }
}
