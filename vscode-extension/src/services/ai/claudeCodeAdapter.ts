import { execFile } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { AIRuntimeAdapterError, BaseAIAdapter, extractFirstJsonObject } from './aiRuntime';

const execFileAsync = promisify(execFile);

export class ClaudeCodeAdapter extends BaseAIAdapter {
  protected async callAI(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const timeoutMs = cfg.get<number>('timeoutMs') ?? 30000;
    try {
      const model = cfg.get<string>('claudeModel') ?? 'claude-haiku-4-5-20251001';
      const localBin = path.join(os.homedir(), '.local', 'bin');
      const env = { ...process.env, PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ''}` };
      const { stdout } = await execFileAsync('claude', ['-p', '--model', model], {
        timeout: timeoutMs,
        shell: false,
        env,
        input: prompt,
      });
      return stdout;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AIRuntimeAdapterError(`claude -p failed: ${msg}`);
    }
  }

  protected parseJson(text: string): Record<string, unknown> {
    const json = extractFirstJsonObject(text, 'claude');
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON in claude output: ${json.slice(0, 200)}`);
    }
  }
}
