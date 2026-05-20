import { DecisionCard, Decision, GeneratedApp, Project } from '../models/types';

export type AIRuntimeProvider = 'openai-compatible' | 'baseline';

export interface AIRuntimeAdapter {
  generateNextCard(
    project: Project,
    decisions: Decision[],
    accepted: DecisionCard[],
    rejected: DecisionCard[],
  ): Promise<DecisionCard | null>;

  generateApp(project: Project, acceptedCards: DecisionCard[]): Promise<GeneratedApp>;
}

export class AIRuntimeAdapterError extends Error {}
