"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const websocketServer_1 = require("./services/websocketServer");
const aiAdapter_1 = require("./services/aiAdapter");
const baselineDopamine_1 = require("./services/baselineDopamine");
const builderCortex_1 = require("./services/builderCortex");
const decisionStore_1 = require("./services/decisionStore");
const githubPublisher_1 = require("./services/githubPublisher");
let server = null;
let cortex = null;
let store = null;
let currentProjectId = null;
async function activate(context) {
    const output = vscode.window.createOutputChannel('DDD Builder Cortex');
    store = new decisionStore_1.DecisionStore();
    const storagePath = context.globalStorageUri.fsPath;
    fs.mkdirSync(storagePath, { recursive: true });
    await store.init(storagePath);
    const ws = new websocketServer_1.DDDWebSocketServer(output);
    const ai = new aiAdapter_1.AIAdapter(context);
    const baseline = new baselineDopamine_1.BaselineDopamine();
    server = ws;
    cortex = new builderCortex_1.BuilderCortex(ws, ai, baseline, store, output);
    ws.onEvent = async (event) => {
        if (event.type === 'startSession') {
            const e = event;
            await cortex.registerProject(e.project);
            currentProjectId = e.project.id;
            output.appendLine(`[DDD] Session started: ${e.project.title}`);
        }
        else if (event.type === 'swipe') {
            const e = event;
            await cortex.handleSwipe(e.projectId, e.cardId, e.action);
        }
    };
    // Status bar
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = '$(zap) DDD Ready';
    statusBar.command = 'ddd.startSession';
    statusBar.show();
    context.subscriptions.push(statusBar);
    context.subscriptions.push(vscode.commands.registerCommand('ddd.configureAI', async () => {
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'AI API Base URL',
            value: 'https://api.openai.com/v1',
        });
        if (!baseUrl) {
            return;
        }
        const model = await vscode.window.showInputBox({
            prompt: 'Model name',
            value: 'gpt-4o-mini',
        });
        if (!model) {
            return;
        }
        const apiKey = await vscode.window.showInputBox({
            prompt: 'API Key',
            password: true,
        });
        if (!apiKey) {
            return;
        }
        await context.secrets.store('ddd.apiKey', apiKey);
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        await cfg.update('baseUrl', baseUrl, vscode.ConfigurationTarget.Global);
        await cfg.update('model', model, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('DDD: AI provider configured');
    }), vscode.commands.registerCommand('ddd.startSession', () => {
        ws.start(3000);
        statusBar.text = '$(zap) DDD Connected';
        vscode.window.showInformationMessage('DDD: Session started — connect mobile app to ws://localhost:3000');
    }), vscode.commands.registerCommand('ddd.generateApp', async () => {
        if (!currentProjectId) {
            vscode.window.showErrorMessage('DDD: No active project. Start a session first.');
            return;
        }
        await cortex.generateApp(currentProjectId);
        vscode.window.showInformationMessage('DDD: App generated');
    }), vscode.commands.registerCommand('ddd.openPreview', () => {
        if (!currentProjectId) {
            vscode.window.showWarningMessage('DDD: No active project. Start a session first.');
            return;
        }
        cortex.startPreview();
    }), vscode.commands.registerCommand('ddd.publishToGitHub', async () => {
        if (!currentProjectId) {
            vscode.window.showErrorMessage('DDD: No active project.');
            return;
        }
        const publisher = new githubPublisher_1.GitHubPublisher();
        const decisions = await store.getDecisions(currentProjectId);
        let app = await store.getGeneratedApp(currentProjectId);
        if (!app) {
            app = await cortex.generateApp(currentProjectId);
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
            ws.send({ type: 'pr', repositoryUrl: result.repositoryUrl, branchName: result.branchName, url: result.pullRequestUrl });
            vscode.window.showInformationMessage(`DDD: PR created → ${result.pullRequestUrl}`);
        }
        else {
            vscode.window.showWarningMessage('DDD: GitHub push failed. Local files saved.');
        }
    }));
    output.appendLine('[DDD] Builder Cortex activated');
}
async function deactivate() {
    server?.stop();
    await store?.close();
}
//# sourceMappingURL=extension.js.map