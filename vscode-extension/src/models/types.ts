export interface Project {
  id: string;
  title: string;
  initialPrompt: string;
  status: 'draft' | 'building' | 'generated' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export type DecisionCardType =
  | 'concept'
  | 'feature'
  | 'ui'
  | 'flow'
  | 'data'
  | 'moment'
  | 'reward'
  | 'polish'
  | 'risk';

export type DecisionCardStatus = 'pending' | 'accepted' | 'rejected';

export interface DecisionCard {
  id: string;
  projectId: string;
  type: DecisionCardType;
  title: string;
  hook: string;
  description: string;
  payoff: string;
  acceptLabel: string;
  rejectLabel: string;
  payload: Record<string, unknown>;
  predictedReward: string;
  noveltyScore: number;
  effortScore: number;
  dopamineScore: number;
  status: DecisionCardStatus;
}

export type DecisionAction = 'accepted' | 'rejected';

export interface Decision {
  id: string;
  projectId: string;
  cardId: string;
  action: DecisionAction;
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
export type ErrorCode =
  | 'INVALID_EVENT'
  | 'PROJECT_NOT_FOUND'
  | 'CARD_NOT_FOUND'
  | 'AI_RUNTIME_UNAVAILABLE'
  | 'AI_RESPONSE_INVALID'
  | 'GITHUB_UNAVAILABLE'
  | 'PREVIEW_FAILED'
  | 'UNKNOWN_ERROR';

export type PRStatus = 'created' | 'localSaved';

export interface SwipeEvent {
  type: 'swipe';
  projectId: string;
  cardId: string;
  action: DecisionAction;
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
  projectId: string;
  url: string;
}

export interface PREvent {
  type: 'pr';
  projectId: string;
  repositoryUrl: string;
  branchName: string;
  url: string;
  status: PRStatus;
}

export interface ErrorEvent {
  type: 'error';
  projectId?: string;
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

export type IncomingEvent = SwipeEvent | StartSessionEvent;
export type OutgoingEvent = CardEvent | PreviewEvent | PREvent | ErrorEvent;
