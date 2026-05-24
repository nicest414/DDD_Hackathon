import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { AIRuntimeAdapterError, BaseAIAdapter, extractFirstJsonObject } from './aiRuntime';

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findOnPath(command: string, env: NodeJS.ProcessEnv): string | undefined {
  const pathValue = env.PATH ?? env.Path ?? '';
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) { continue; }
    const candidate = path.join(dir, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function findClaudeExecutable(env: NodeJS.ProcessEnv): string {
  const candidates = [
    'claude',
    path.join(os.homedir(), '.local', 'bin', 'claude'),
  ];

  for (const candidate of candidates) {
    if (candidate === 'claude') {
      const resolved = findOnPath(candidate, env);
      if (resolved) { return resolved; }
      continue;
    }
    if (isExecutable(candidate)) { return candidate; }
  }

  return 'claude';
}

function runClaude(prompt: string, timeoutMs: number, env: NodeJS.ProcessEnv, model: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(findClaudeExecutable(env), ['-p', '--model', model], {
      shell: false,
      env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      child.stdin.off('error', fail);
      reject(err);
    };

    const timer = setTimeout(() => {
      if (settled) { return; }
      settled = true;
      child.stdin.off('error', fail);
      child.kill();
      reject(new AIRuntimeAdapterError(`claude -p timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });

    child.once('error', fail);
    child.stdin.once('error', fail);

    child.once('close', (code) => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      child.stdin.off('error', fail);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new AIRuntimeAdapterError(`claude -p exited with code ${code}: ${stderr || stdout}`));
    });

    try {
      child.stdin.end(prompt);
    } catch (err) {
      fail(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export class ClaudeCodeAdapter extends BaseAIAdapter {
  protected async callAI(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const timeoutMs = cfg.get<number>('timeoutMs') ?? 30000;
    try {
      const model = cfg.get<string>('claudeModel') ?? 'claude-haiku-4-5-20251001';
      const localBin = path.join(os.homedir(), '.local', 'bin');
      const env = { ...process.env, PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ''}` };
      return await runClaude(prompt, timeoutMs, env, model);
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
