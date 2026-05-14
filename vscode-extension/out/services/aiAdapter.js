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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAdapter = exports.AIAdapterError = void 0;
const vscode = __importStar(require("vscode"));
const openai_1 = __importDefault(require("openai"));
class AIAdapterError extends Error {
}
exports.AIAdapterError = AIAdapterError;
class AIAdapter {
    client() {
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        const apiKey = process.env['DDD_API_KEY'] ?? '';
        return new openai_1.default({
            baseURL: cfg.get('baseUrl'),
            apiKey,
            timeout: cfg.get('timeoutMs') ?? 30000,
        });
    }
    async generateNextCard(project, decisions, accepted, rejected) {
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        const model = cfg.get('model') ?? 'gpt-4o-mini';
        const maxTokens = cfg.get('maxTokens') ?? 2000;
        const prompt = `
You are an AI assistant helping design a mobile app.
Project: "${project.title}"
Initial prompt: "${project.initialPrompt}"
Accepted features: ${accepted.map((c) => c.title).join(', ') || 'none'}
Rejected features: ${rejected.map((c) => c.title).join(', ') || 'none'}

Suggest the next most important feature card in JSON:
{
  "type": "feature",
  "title": "...",
  "description": "...",
  "predictedReward": "...",
  "noveltyScore": 0.0-1.0,
  "effortScore": 0.0-1.0
}
Only output JSON, no markdown.`;
        const res = await this.client().chat.completions.create({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = res.choices[0]?.message?.content ?? '';
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new AIAdapterError(`Invalid JSON from AI: ${text}`);
        }
        return {
            id: `ai-${Date.now()}`,
            projectId: project.id,
            type: parsed['type'] ?? 'feature',
            title: parsed['title'],
            description: parsed['description'],
            payload: {},
            predictedReward: parsed['predictedReward'] ?? '',
            noveltyScore: parsed['noveltyScore'] ?? 0.5,
            effortScore: parsed['effortScore'] ?? 0.5,
            status: 'pending',
        };
    }
    async generateApp(project, accepted) {
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        const model = cfg.get('model') ?? 'gpt-4o-mini';
        const prompt = `
Generate a minimal React app spec for: "${project.title}"
Using these accepted features: ${accepted.map((c) => c.title).join(', ')}

Return JSON:
{
  "name": "...",
  "summary": "...",
  "screens": [{"name":"...","description":"..."}],
  "features": ["..."]
}
Only output JSON.`;
        const res = await this.client().chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
        });
        const text = res.choices[0]?.message?.content ?? '';
        let spec;
        try {
            spec = JSON.parse(text);
        }
        catch {
            throw new AIAdapterError(`Invalid JSON from AI: ${text}`);
        }
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
exports.AIAdapter = AIAdapter;
//# sourceMappingURL=aiAdapter.js.map