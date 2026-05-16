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
const cardTypes = new Set(['concept', 'feature', 'ui', 'flow', 'data']);
function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new AIAdapterError(`AI response is missing required field: ${field}`);
    }
    return value.trim();
}
function optionalString(value, fallback) {
    return typeof value === 'string' ? value.trim() : fallback;
}
function coerceScore(value, fallback = 0.5) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.min(1, Math.max(0, numeric));
}
class AIAdapter {
    client() {
        const cfg = vscode.workspace.getConfiguration('ddd.ai');
        const apiKey = process.env['DDD_API_KEY'];
        if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            throw new AIAdapterError('DDD_API_KEY environment variable is required');
        }
        return new openai_1.default({
            baseURL: cfg.get('baseUrl'),
            apiKey: apiKey.trim(),
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
        const rawType = optionalString(parsed['type'], 'feature');
        const type = cardTypes.has(rawType)
            ? rawType
            : 'feature';
        const title = requiredString(parsed['title'], 'title');
        const description = requiredString(parsed['description'], 'description');
        const predictedReward = optionalString(parsed['predictedReward'], '');
        const noveltyScore = coerceScore(parsed['noveltyScore']);
        const effortScore = coerceScore(parsed['effortScore']);
        return {
            id: `ai-${Date.now()}`,
            projectId: project.id,
            type,
            title,
            description,
            payload: {},
            predictedReward,
            noveltyScore,
            effortScore,
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