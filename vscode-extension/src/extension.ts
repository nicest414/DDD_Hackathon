import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DDDWebSocketServer } from './services/websocketServer';
import { AIRuntimeDispatcher } from './services/ai/aiDispatcher';
import { BaselineDopamine } from './services/baselineDopamine';
import { BuilderCortex } from './services/builderCortex';
import { DecisionStore } from './services/decisionStore';
import { GitHubPublisher } from './services/githubPublisher';
import { SwipeEvent, StartSessionEvent } from './models/types';

let server: DDDWebSocketServer | null = null;
let cortex: BuilderCortex | null = null;
let store: DecisionStore | null = null;
let currentProjectId: string | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('DDD Builder Cortex');
  store = new DecisionStore();

  const storagePath = context.globalStorageUri.fsPath;
  fs.mkdirSync(storagePath, { recursive: true });
  await store.init(storagePath);

  const ws = new DDDWebSocketServer(output);
  const baseline = new BaselineDopamine();
  const ai = new AIRuntimeDispatcher(context, baseline, output);
  server = ws;
  cortex = new BuilderCortex(ws, ai, baseline, store, output);

  ws.onEvent = async (event) => {
    if (event.type === 'startSession') {
      const e = event as StartSessionEvent;
      await cortex!.registerProject(e.project);
      currentProjectId = e.project.id;
      output.appendLine(`[DDD] Session started: ${e.project.title}`);
      await cortex!.startProject(e.project);
    } else if (event.type === 'swipe') {
      const e = event as SwipeEvent;
      await cortex!.handleSwipe(e.projectId, e.cardId, e.action, e.createdAt);
    }
  };

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBar.text = '$(zap) DDD Ready';
  statusBar.command = 'ddd.startSession';
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('ddd.configureAI', async () => {
      const provider = await vscode.window.showQuickPick(
        [
          { label: 'OpenAI-compatible API', value: 'openai-compatible' },
          { label: 'Claude Code (claude -p)', value: 'claude-code' },
          { label: 'Codex CLI (codex exec)', value: 'codex-cli' },
          { label: 'Baseline mock', value: 'baseline' },
        ],
        {
          placeHolder: 'AI Runtime Provider',
        },
      );
      if (!provider) { return; }

      const cfg = vscode.workspace.getConfiguration('ddd.ai');

      if (provider.value === 'claude-code') {
        await cfg.update('provider', provider.value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('DDD: AI runtime configured (Claude Code)');
        return;
      }

      if (provider.value === 'codex-cli') {
        await cfg.update('provider', provider.value, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('DDD: AI runtime configured (Codex CLI)');
        return;
      }

      if (provider.value === 'openai-compatible') {
        const baseUrl = await vscode.window.showInputBox({
          prompt: 'OpenAI-compatible API base URL',
          value: (await context.secrets.get('ddd.baseUrl')) ?? cfg.get<string>('baseUrl') ?? 'https://api.openai.com/v1',
        });

        if (!baseUrl?.trim()) { return; }

        const model = await vscode.window.showInputBox({
          prompt: 'Model name',
          value: (await context.secrets.get('ddd.model')) ?? cfg.get<string>('model') ?? 'gpt-4o-mini',
        });
        if (!model?.trim()) { return; }

        const apiKey = await vscode.window.showInputBox({
          prompt: 'API Key',
          password: true,
        });
        if (!apiKey) { return; }

        await context.secrets.store('ddd.apiKey', apiKey);
        await context.secrets.store('ddd.baseUrl', baseUrl.trim());
        await context.secrets.store('ddd.model', model.trim());
        await cfg.update('provider', provider.value, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage('DDD: AI runtime configured (OpenAI-compatible)');
        return;
      }

      // baseline: no extra config
      await cfg.update('provider', provider.value, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage('DDD: No AI runtime configured, using baseline mock implementation');
    }),

    vscode.commands.registerCommand('ddd.startSession', () => {
      ws.start(3000);
      statusBar.text = '$(zap) DDD Connected';
      vscode.window.showInformationMessage(
        'DDD: Session started — connect mobile app to ws://localhost:3000',
      );
    }),

    vscode.commands.registerCommand('ddd.generateApp', async () => {
      if (!currentProjectId) {
        vscode.window.showErrorMessage('DDD: No active project. Start a session first.');
        return;
      }
      const app = await cortex!.generateApp(currentProjectId);
      if (!app) {
        vscode.window.showErrorMessage('DDD: App generation failed.');
        return;
      }
      const repoPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (repoPath) {
        try {
          const decisions = await store!.getDecisions(currentProjectId);
          await fs.promises.writeFile(path.join(repoPath, 'ddd-spec.json'), JSON.stringify(app.spec, null, 2));
          await fs.promises.writeFile(path.join(repoPath, 'ddd-decisions.json'), JSON.stringify(decisions, null, 2));
          vscode.window.showInformationMessage('DDD: ddd-spec.json / ddd-decisions.json を生成しました');
        } catch (err) {
          console.error('[DDD] Failed to write ddd-spec.json / ddd-decisions.json:', err);
          vscode.window.showErrorMessage('DDD: ddd-spec.json / ddd-decisions.json の書き込みに失敗しました');
        }
      } else {
        vscode.window.showInformationMessage('DDD: App generated');
      }
    }),

    vscode.commands.registerCommand('ddd.openPreview', () => {
      if (!currentProjectId) {
        vscode.window.showWarningMessage('DDD: No active project. Start a session first.');
        return;
      }
      cortex!.startPreview();
    }),

    vscode.commands.registerCommand('ddd.publishToGitHub', async () => {
      if (!currentProjectId) {
        vscode.window.showErrorMessage('DDD: No active project.');
        return;
      }
      const projectId = currentProjectId;
      const publisher = new GitHubPublisher();
      const decisions = await store!.getDecisions(projectId);
      let app = await store!.getGeneratedApp(projectId);
      if (!app) {
        app = await cortex!.generateApp(projectId);
      }
      if (!app) {
        vscode.window.showErrorMessage('DDD: App generation failed.');
        return;
      }
      const repoPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!repoPath) {
        vscode.window.showErrorMessage('DDD: No workspace folder open.');
        return;
      }
      let result;
      try {
        result = await publisher.publish(app, decisions, repoPath);
      } catch (err) {
        output.appendLine(`[DDD] Publish failed before local files were saved: ${err instanceof Error ? err.message : String(err)}`);
        ws.send({
          type: 'error',
          projectId,
          code: 'GITHUB_UNAVAILABLE',
          message: 'DDD: GitHub publish failed before local files were saved.',
          recoverable: true,
        });
        vscode.window.showErrorMessage('DDD: GitHub publish failed before local files were saved.');
        return;
      }

      if (result.pullRequestUrl) {
        ws.send({
          type: 'pr',
          projectId,
          repositoryUrl: result.repositoryUrl,
          branchName: result.branchName,
          url: result.pullRequestUrl,
          status: 'created',
        });
        vscode.window.showInformationMessage(`DDD: PR created → ${result.pullRequestUrl}`);
      } else {
        ws.send({
          type: 'pr',
          projectId,
          repositoryUrl: '',
          branchName: result.branchName,
          url: '',
          status: 'localSaved',
        });
        vscode.window.showWarningMessage('DDD: GitHub push failed. Local files saved.');
      }
    }),
  );

  output.appendLine('[DDD] Builder Cortex activated');
}

export async function deactivate(): Promise<void> {
  server?.stop();
  await store?.close();
}
