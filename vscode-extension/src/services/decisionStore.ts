import * as path from 'path';
import { Project, DecisionCard, Decision, GeneratedApp } from '../models/types';

// Lazily required so the extension loads even if better-sqlite3 isn't compiled yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export class DecisionStore {
  private db: DB | null = null;

  init(storagePath: string): void {
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

  saveProject(p: Project): void {
    this.db?.prepare(`
      INSERT OR REPLACE INTO projects VALUES (?,?,?,?,?,?)
    `).run(p.id, p.title, p.initialPrompt, p.status, p.createdAt, p.updatedAt);
  }

  getProject(id: string): Project | undefined {
    return this.db?.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  saveDecision(d: Decision): void {
    this.db?.prepare(`
      INSERT OR REPLACE INTO decisions VALUES (?,?,?,?,?)
    `).run(d.id, d.cardId, d.action, d.reason, d.createdAt);
  }

  getDecisions(projectId: string): Decision[] {
    return this.db?.prepare(`
      SELECT d.* FROM decisions d
      JOIN decision_cards c ON c.id = d.cardId
      WHERE c.projectId = ?
    `).all(projectId) ?? [];
  }

  saveCard(c: DecisionCard): void {
    this.db?.prepare(`
      INSERT OR REPLACE INTO decision_cards VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(c.id, c.projectId, c.type, c.title, c.description,
      JSON.stringify(c.payload), c.predictedReward, c.noveltyScore, c.effortScore, c.status);
  }

  saveGeneratedApp(app: GeneratedApp): void {
    this.db?.prepare(`
      INSERT OR REPLACE INTO generated_apps VALUES (?,?,?,?,?,?,?,?,?)
    `).run(app.id, app.projectId, JSON.stringify(app.spec), app.source,
      JSON.stringify(app.previewState), app.repositoryUrl, app.branchName,
      app.pullRequestUrl, app.updatedAt);
  }

  getGeneratedApp(projectId: string): GeneratedApp | undefined {
    const row = this.db?.prepare('SELECT * FROM generated_apps WHERE projectId = ?').get(projectId);
    if (!row) { return undefined; }

    return {
      id: row.id,
      projectId: row.projectId,
      spec: JSON.parse(row.spec),
      source: row.source,
      previewState: JSON.parse(row.previewState),
      repositoryUrl: row.repositoryUrl,
      branchName: row.branchName,
      pullRequestUrl: row.pullRequestUrl,
      updatedAt: row.updatedAt,
    };
  }
}
