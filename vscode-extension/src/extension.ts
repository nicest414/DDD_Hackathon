import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DDDWebSocketServer } from './services/websocketServer';
import { AIAdapter } from './services/aiAdapter';
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
  const ai = new AIAdapter(context);
  const baseline = new BaselineDopamine();
  server = ws;
  cortex = new BuilderCortex(ws, ai, baseline, store, output);

  ws.onEvent = async (event) => {
    if (event.type === 'startSession') {
      const e = event as StartSessionEvent;
      await cortex!.registerProject(e.project);
      currentProjectId = e.project.id;
      output.appendLine(`[DDD] Session started: ${e.project.title}`);
    } else if (event.type === 'swipe') {
      const e = event as SwipeEvent;
      await cortex!.handleSwipe(e.projectId, e.cardId, e.action);
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
      const baseUrl = await vscode.window.showInputBox({
        prompt: 'AI API Base URL',
        value: 'https://api.openai.com/v1',
      });
      if (!baseUrl) { return; }

      const model = await vscode.window.showInputBox({
        prompt: 'Model name',
        value: 'gpt-4o-mini',
      });
      if (!model) { return; }

      const apiKey = await vscode.window.showInputBox({
        prompt: 'API Key',
        password: true,
      });
      if (!apiKey) { return; }

      await context.secrets.store('ddd.apiKey', apiKey);

      const cfg = vscode.workspace.getConfiguration('ddd.ai');
      await cfg.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
      await cfg.update('model', model, vscode.ConfigurationTarget.Global);

      vscode.window.showInformationMessage('DDD: AI provider configured');
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
      await cortex!.generateApp(currentProjectId);
      vscode.window.showInformationMessage('DDD: App generated');
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
      const publisher = new GitHubPublisher();
      const decisions = await store!.getDecisions(currentProjectId);
      let app = await store!.getGeneratedApp(currentProjectId);
      if (!app) {
        app = await cortex!.generateApp(currentProjectId);
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
      const result = await publisher.publish(app, decisions, repoPath);

      if (result.pullRequestUrl) {
        ws.send({
          type: 'pr',
          projectId: currentProjectId,
          repositoryUrl: result.repositoryUrl,
          branchName: result.branchName,
          url: result.pullRequestUrl,
          status: 'created',
        });
        vscode.window.showInformationMessage(`DDD: PR created → ${result.pullRequestUrl}`);
      } else {
        ws.send({
          type: 'pr',
          projectId: currentProjectId,
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
