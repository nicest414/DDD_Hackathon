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
const path = __importStar(require("path"));
function safeParseJSON(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
class DecisionStore {
    constructor() {
        this.db = null;
    }
    init(storagePath) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require('better-sqlite3');
        this.db = new Database(path.join(storagePath, 'ddd.db'));
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, title TEXT, initialPrompt TEXT,
        status TEXT, createdAt TEXT, updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS decision_cards (
        id TEXT PRIMARY KEY, projectId TEXT, type TEXT, title TEXT,
        description TEXT, payload TEXT, predictedReward TEXT,
        noveltyScore REAL, effortScore REAL, status TEXT
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY, cardId TEXT, action TEXT,
        reason TEXT, createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS generated_apps (
        id TEXT PRIMARY KEY, projectId TEXT, spec TEXT, source TEXT,
        previewState TEXT, repositoryUrl TEXT, branchName TEXT,
        pullRequestUrl TEXT, updatedAt TEXT
      );
    `);
    }
    assertInitialized() {
        if (!this.db) {
            throw new Error('DecisionStore has not been initialized');
        }
        return this.db;
    }
    saveProject(p) {
        const db = this.assertInitialized();
        db.prepare(`
      INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?,?)
    `).run(p.id, p.title, p.initialPrompt, p.status, p.createdAt, p.updatedAt);
    }
    getProject(id) {
        const db = this.assertInitialized();
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    }
    saveDecision(d) {
        const db = this.assertInitialized();
        db.prepare('DELETE FROM decisions WHERE cardId = ?').run(d.cardId);
        db.prepare(`
      INSERT OR REPLACE INTO decisions VALUES (?,?,?,?,?)
    `).run(d.id, d.cardId, d.action, d.reason, d.createdAt);
    }
    getDecisions(projectId) {
        const db = this.assertInitialized();
        return db.prepare(`
      SELECT d.* FROM decisions d
      JOIN decision_cards c ON c.id = d.cardId
      WHERE c.projectId = ?
    `).all(projectId);
    }
    saveCard(c) {
        const db = this.assertInitialized();
        db.prepare(`
      INSERT OR REPLACE INTO decision_cards VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(c.id, c.projectId, c.type, c.title, c.description, JSON.stringify(c.payload), c.predictedReward, c.noveltyScore, c.effortScore, c.status);
    }
    saveGeneratedApp(app) {
        const db = this.assertInitialized();
        db.prepare(`
      INSERT OR REPLACE INTO generated_apps VALUES (?,?,?,?,?,?,?,?,?)
    `).run(app.id, app.projectId, JSON.stringify(app.spec), app.source, JSON.stringify(app.previewState), app.repositoryUrl, app.branchName, app.pullRequestUrl, app.updatedAt);
    }
    getGeneratedApp(projectId) {
        const db = this.assertInitialized();
        const row = db.prepare('SELECT * FROM generated_apps WHERE projectId = ?').get(projectId);
        if (!row) {
            return undefined;
        }
        return {
            id: row.id,
            projectId: row.projectId,
            spec: safeParseJSON(row.spec, {}),
            source: row.source,
            previewState: safeParseJSON(row.previewState, {}),
            repositoryUrl: row.repositoryUrl,
            branchName: row.branchName,
            pullRequestUrl: row.pullRequestUrl,
            updatedAt: row.updatedAt,
        };
    }
}
exports.DecisionStore = DecisionStore;
//# sourceMappingURL=decisionStore.js.map