export interface Project {
  id: string;
  title: string;
  initialPrompt: string;
  status: 'draft' | 'building' | 'generated' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface DecisionCard {
  id: string;
  projectId: string;
  type: 'concept' | 'feature' | 'ui' | 'flow' | 'data';
  title: string;
  description: string;
  payload: Record<string, unknown>;
  predictedReward: string;
  noveltyScore: number;
  effortScore: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface Decision {
  id: string;
  cardId: string;
  action: 'accepted' | 'rejected';
  reason: string;
  createdAt: string;
}

export interface GeneratedApp {
  id: string;
  projectId: string;
  spec: Record<string, unknown>;
  source: string;
  previewState: Record<string, unknown>;
  repositoryUrl: string;
  branchName: string;
  pullRequestUrl: string;
  updatedAt: string;
}

export interface AIProviderConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyRef: string;
  timeoutMs: number;
  maxTokens: number;
  fallbackEnabled: boolean;
}

// WebSocket event types
export interface SwipeEvent {
  type: 'swipe';
  projectId: string;
  cardId: string;
  action: 'accepted' | 'rejected';
  createdAt: string;
}

export interface StartSessionEvent {
  type: 'startSession';
  project: Project;
}

export interface CardEvent {
  type: 'card';
  card: DecisionCard;
}

export interface PreviewEvent {
  type: 'preview';
  url: string;
}

export interface PREvent {
  type: 'pr';
  repositoryUrl: string;
  branchName: string;
  url: string;
}

export type IncomingEvent = SwipeEvent | StartSessionEvent;
export type OutgoingEvent = CardEvent | PreviewEvent | PREvent;
