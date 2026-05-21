import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { AIRuntimeAdapterError, BaseAIAdapter } from './aiRuntime';

const execFileAsync = promisify(execFile);

export class ClaudeCodeAdapter extends BaseAIAdapter {
  protected async callAI(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const timeoutMs = cfg.get<number>('timeoutMs') ?? 30000;
    try {
      const { stdout } = await execFileAsync('claude', ['-p', prompt], {
        timeout: timeoutMs,
        shell: false,
      });
      return stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AIRuntimeAdapterError(`claude -p failed: ${msg}`);
    }
  }

  protected parseJson(text: string): Record<string, unknown> {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new AIRuntimeAdapterError(`No JSON found in claude output: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON in claude output: ${match[0].slice(0, 200)}`);
    }
  }
}
