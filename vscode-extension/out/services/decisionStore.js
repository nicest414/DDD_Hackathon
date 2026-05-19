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
function stringOrFallback(value, fallback) {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
function numberOrFallback(value, fallback) {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
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
        hook text NOT NULL,
        description text NOT NULL,
        payoff text NOT NULL,
        accept_label text NOT NULL,
        reject_label text NOT NULL,
        payload jsonb NOT NULL,
        predicted_reward text NOT NULL,
        novelty_score double precision NOT NULL,
        effort_score double precision NOT NULL,
        dopamine_score double precision NOT NULL,
        status text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id text PRIMARY KEY,
        project_id text NOT NULL,
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
        await db.exec(`
      ALTER TABLE decision_cards ADD COLUMN IF NOT EXISTS hook text NOT NULL DEFAULT '';
      ALTER TABLE decision_cards ADD COLUMN IF NOT EXISTS payoff text NOT NULL DEFAULT '';
      ALTER TABLE decision_cards ADD COLUMN IF NOT EXISTS accept_label text NOT NULL DEFAULT 'これ欲しい';
      ALTER TABLE decision_cards ADD COLUMN IF NOT EXISTS reject_label text NOT NULL DEFAULT '今はいらない';
      ALTER TABLE decision_cards ADD COLUMN IF NOT EXISTS dopamine_score double precision NOT NULL DEFAULT 0.5;
      ALTER TABLE decisions ADD COLUMN IF NOT EXISTS project_id text NOT NULL DEFAULT '';
    `);
        await db.exec(`
      UPDATE decisions
      SET project_id = decision_cards.project_id
      FROM decision_cards
      WHERE decisions.card_id = decision_cards.id
        AND decisions.project_id = '';
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
        let projectId = stringOrFallback(decision.projectId, '');
        if (!projectId) {
            const card = await this.assertInitialized().query('SELECT project_id FROM decision_cards WHERE id = $1', [decision.cardId]);
            projectId = card.rows[0]?.project_id ?? '';
        }
        await this.assertInitialized().query(`INSERT INTO decisions (id, project_id, card_id, action, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (card_id) DO UPDATE SET
         id = EXCLUDED.id,
         project_id = EXCLUDED.project_id,
         action = EXCLUDED.action,
         reason = EXCLUDED.reason,
         created_at = EXCLUDED.created_at`, [decision.id, projectId, decision.cardId, decision.action, decision.reason, decision.createdAt]);
    }
    async getDecisions(projectId) {
        const result = await this.assertInitialized().query(`SELECT *
       FROM decisions
       WHERE project_id = $1
       ORDER BY created_at ASC`, [projectId]);
        return result.rows.map((row) => ({
            id: row.id,
            projectId: row.project_id,
            cardId: row.card_id,
            action: row.action,
            reason: row.reason,
            createdAt: row.created_at,
        }));
    }
    async saveCard(card) {
        const hook = stringOrFallback(card.hook, card.title);
        const payoff = stringOrFallback(card.payoff, card.predictedReward || card.description);
        const acceptLabel = stringOrFallback(card.acceptLabel, 'これ欲しい');
        const rejectLabel = stringOrFallback(card.rejectLabel, '今はいらない');
        const dopamineScore = numberOrFallback(card.dopamineScore, 0.5);
        await this.assertInitialized().query(`INSERT INTO decision_cards (
         id, project_id, type, title, hook, description, payoff,
         accept_label, reject_label, payload, predicted_reward,
         novelty_score, effort_score, dopamine_score, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         hook = EXCLUDED.hook,
         description = EXCLUDED.description,
         payoff = EXCLUDED.payoff,
         accept_label = EXCLUDED.accept_label,
         reject_label = EXCLUDED.reject_label,
         payload = EXCLUDED.payload,
         predicted_reward = EXCLUDED.predicted_reward,
         novelty_score = EXCLUDED.novelty_score,
         effort_score = EXCLUDED.effort_score,
         dopamine_score = EXCLUDED.dopamine_score,
         status = EXCLUDED.status`, [
            card.id,
            card.projectId,
            card.type,
            card.title,
            hook,
            card.description,
            payoff,
            acceptLabel,
            rejectLabel,
            JSON.stringify(card.payload),
            card.predictedReward,
            card.noveltyScore,
            card.effortScore,
            dopamineScore,
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