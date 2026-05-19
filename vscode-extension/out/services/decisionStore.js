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
exports.DecisionStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pglite_1 = require("@electric-sql/pglite");
function asRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
}
function parseJsonRecord(value) {
    if (typeof value === 'string') {
        try {
            return asRecord(JSON.parse(value));
        }
        catch {
            return {};
        }
    }
    return asRecord(value);
}
function readLegacyStore(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    }
    catch {
        return null;
    }
}
class DecisionStore {
    constructor() {
        this.db = null;
    }
    async init(storagePath) {
        fs.mkdirSync(storagePath, { recursive: true });
        this.db = new pglite_1.PGlite(path.join(storagePath, 'pgdata'));
        await this.migrate();
        await this.importLegacyJson(path.join(storagePath, 'ddd-store.json'));
    }
    assertInitialized() {
        if (!this.db) {
            throw new Error('DecisionStore has not been initialized');
        }
        return this.db;
    }
    async migrate() {
        const db = this.assertInitialized();
        await db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY,
        title text NOT NULL,
        initial_prompt text NOT NULL,
        status text NOT NULL,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decision_cards (
        id text PRIMARY KEY,
        project_id text NOT NULL,
        type text NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        payload jsonb NOT NULL,
        predicted_reward text NOT NULL,
        novelty_score double precision NOT NULL,
        effort_score double precision NOT NULL,
        status text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id text PRIMARY KEY,
        card_id text NOT NULL UNIQUE,
        action text NOT NULL,
        reason text NOT NULL,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS generated_apps (
        id text PRIMARY KEY,
        project_id text NOT NULL,
        spec jsonb NOT NULL,
        source text NOT NULL,
        preview_state jsonb NOT NULL,
        repository_url text NOT NULL,
        branch_name text NOT NULL,
        pull_request_url text NOT NULL,
        updated_at text NOT NULL
      );
    `);
    }
    async importLegacyJson(filePath) {
        const legacy = readLegacyStore(filePath);
        if (!legacy) {
            return;
        }
        const existing = await this.assertInitialized().query('SELECT COUNT(*)::int AS count FROM projects');
        if ((existing.rows[0]?.count ?? 0) > 0) {
            return;
        }
        for (const project of legacy.projects ?? []) {
            await this.saveProject(project);
        }
        for (const card of legacy.decisionCards ?? []) {
            await this.saveCard(card);
        }
        for (const decision of legacy.decisions ?? []) {
            await this.saveDecision(decision);
        }
        for (const app of legacy.generatedApps ?? []) {
            await this.saveGeneratedApp(app);
        }
    }
    async saveProject(project) {
        await this.assertInitialized().query(`INSERT INTO projects (id, title, initial_prompt, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         initial_prompt = EXCLUDED.initial_prompt,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`, [project.id, project.title, project.initialPrompt, project.status, project.createdAt, project.updatedAt]);
    }
    async getProject(id) {
        const result = await this.assertInitialized().query('SELECT * FROM projects WHERE id = $1', [id]);
        const row = result.rows[0];
        if (!row) {
            return undefined;
        }
        return {
            id: row.id,
            title: row.title,
            initialPrompt: row.initial_prompt,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    async saveDecision(decision) {
        await this.assertInitialized().query(`INSERT INTO decisions (id, card_id, action, reason, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (card_id) DO UPDATE SET
         id = EXCLUDED.id,
         action = EXCLUDED.action,
         reason = EXCLUDED.reason,
         created_at = EXCLUDED.created_at`, [decision.id, decision.cardId, decision.action, decision.reason, decision.createdAt]);
    }
    async getDecisions(projectId) {
        const result = await this.assertInitialized().query(`SELECT d.*
       FROM decisions d
       JOIN decision_cards c ON c.id = d.card_id
       WHERE c.project_id = $1
       ORDER BY d.created_at ASC`, [projectId]);
        return result.rows.map((row) => ({
            id: row.id,
            cardId: row.card_id,
            action: row.action,
            reason: row.reason,
            createdAt: row.created_at,
        }));
    }
    async saveCard(card) {
        await this.assertInitialized().query(`INSERT INTO decision_cards (
         id, project_id, type, title, description, payload,
         predicted_reward, novelty_score, effort_score, status
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         payload = EXCLUDED.payload,
         predicted_reward = EXCLUDED.predicted_reward,
         novelty_score = EXCLUDED.novelty_score,
         effort_score = EXCLUDED.effort_score,
         status = EXCLUDED.status`, [
            card.id,
            card.projectId,
            card.type,
            card.title,
            card.description,
            JSON.stringify(card.payload),
            card.predictedReward,
            card.noveltyScore,
            card.effortScore,
            card.status,
        ]);
    }
    async saveGeneratedApp(app) {
        await this.assertInitialized().query(`INSERT INTO generated_apps (
         id, project_id, spec, source, preview_state,
         repository_url, branch_name, pull_request_url, updated_at
       )
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         spec = EXCLUDED.spec,
         source = EXCLUDED.source,
         preview_state = EXCLUDED.preview_state,
         repository_url = EXCLUDED.repository_url,
         branch_name = EXCLUDED.branch_name,
         pull_request_url = EXCLUDED.pull_request_url,
         updated_at = EXCLUDED.updated_at`, [
            app.id,
            app.projectId,
            JSON.stringify(app.spec),
            app.source,
            JSON.stringify(app.previewState),
            app.repositoryUrl,
            app.branchName,
            app.pullRequestUrl,
            app.updatedAt,
        ]);
    }
    async getGeneratedApp(projectId) {
        const result = await this.assertInitialized().query('SELECT * FROM generated_apps WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 1', [projectId]);
        const row = result.rows[0];
        if (!row) {
            return undefined;
        }
        return {
            id: row.id,
            projectId: row.project_id,
            spec: parseJsonRecord(row.spec),
            source: row.source,
            previewState: parseJsonRecord(row.preview_state),
            repositoryUrl: row.repository_url,
            branchName: row.branch_name,
            pullRequestUrl: row.pull_request_url,
            updatedAt: row.updated_at,
        };
    }
    async close() {
        if (!this.db) {
            return;
        }
        await this.db.close();
        this.db = null;
    }
}
exports.DecisionStore = DecisionStore;
//# sourceMappingURL=decisionStore.js.map