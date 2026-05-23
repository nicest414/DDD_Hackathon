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

function findCodexExecutable(env: NodeJS.ProcessEnv): string {
  const candidates = [
    'codex',
    path.join(os.homedir(), '.local', 'bin', 'codex'),
    '/Applications/Codex.app/Contents/Resources/codex',
  ];

  for (const candidate of candidates) {
    if (candidate === 'codex') {
      const resolved = findOnPath(candidate, env);
      if (resolved) { return resolved; }
      continue;
    }
    if (isExecutable(candidate)) { return candidate; }
  }

  return 'codex';
}

function runCodex(prompt: string, timeoutMs: number, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(findCodexExecutable(env), ['exec', '--skip-git-repo-check', '-'], {
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
      reject(new AIRuntimeAdapterError(`codex exec timed out after ${timeoutMs}ms`));
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
      reject(new AIRuntimeAdapterError(`codex exec exited with code ${code}: ${stderr || stdout}`));
    });

    try {
      child.stdin.end(prompt);
    } catch (err) {
      fail(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export class CodexCLIAdapter extends BaseAIAdapter {
  protected async callAI(prompt: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('ddd.ai');
    const timeoutMs = cfg.get<number>('timeoutMs') ?? 30000;
    try {
      const localBin = path.join(os.homedir(), '.local', 'bin');
      const appResources = '/Applications/Codex.app/Contents/Resources';
      const env = {
        ...process.env,
        PATH: `${localBin}${path.delimiter}${appResources}${path.delimiter}${process.env.PATH ?? ''}`,
      };
      return await runCodex(prompt, timeoutMs, env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AIRuntimeAdapterError(`codex exec failed: ${msg}`);
    }
  }

  protected parseJson(text: string): Record<string, unknown> {
    const json = extractFirstJsonObject(text, 'codex');
    try {
      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new AIRuntimeAdapterError(`Invalid JSON in codex output: ${json.slice(0, 200)}`);
    }
  }
}
