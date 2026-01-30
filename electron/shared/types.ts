export type ModeId =
  | 'clean'
  | 'meeting'
  | 'tasks'
  | 'email'
  | 'ticket'
  | 'devnote'
  | 'reminder'
  | 'plan';

// Plan Mode Types
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskEstimate = 'XS' | 'S' | 'M' | 'L' | 'XL';

export interface PlanTask {
  id: string; // Stable ID like "m1-t1"
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  estimate: TaskEstimate;
  priority: TaskPriority;
  status: TaskStatus;
  dependsOn?: string[]; // Task IDs
}

export interface PlanMilestone {
  id: string; // Like "m1", "m2"
  name: string;
  description?: string;
  tasks: PlanTask[];
  priority: TaskPriority;
  dependsOn?: string[]; // Milestone IDs
}

export interface PlanRisk {
  description: string;
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface PlanData {
  projectName: string;
  goal: string;
  targetDate?: string; // ISO date if mentioned
  milestones: PlanMilestone[];
  nextSteps: string[];
  risks: PlanRisk[];
  openQuestions: string[];
  assumptions?: string[];
}

import type { ProposedAction, ActionExecutionResult } from './actions';

export type EnrichedResult = {
  markdown: string;
  json?: unknown;
  actions?: ProposedAction[];
};

export type HistoryItem = {
  id: string;
  createdAt: number;
  updatedAt?: number;
  mode: ModeId;
  language: 'auto' | 'de' | 'en';
  context?: string;
  instruction?: string;
  title?: string;
  transcript: string;
  result: EnrichedResult;
  provider: { stt: 'openai'; llm: 'openai' };
};

export type Settings = {
  hotkey: string;
  saveHistory: boolean;
  defaultMode: ModeId;
  language: 'auto' | 'de' | 'en';
  openaiApiKey?: string;
  openaiTranscribeModel: string;
  openaiChatModel: string;
};

export type PipelineStage = 'recording' | 'transcribing' | 'enriching' | 'done' | 'cancelled';

// Error codes for structured error handling
export type PipelineErrorCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'INVALID_AUDIO_FORMAT'
  | 'AUDIO_TOO_SHORT'
  | 'CANCELLED'
  | 'UNKNOWN';

export type PipelineEvent =
  | { runId: string; type: 'status'; stage: PipelineStage }
  | { runId: string; type: 'transcript'; transcript: string }
  | { runId: string; type: 'result'; result: EnrichedResult }
  | { runId: string; type: 'error'; message: string; code?: PipelineErrorCode };

// Audio payload can be ArrayBuffer, Uint8Array, or number[] (fallback)
export type AudioData = ArrayBuffer | Uint8Array | number[];

export type TranscriptionPayload = {
  audio: AudioData;
  mimeType: string;
  language: 'auto' | 'de' | 'en';
};

export type EnrichmentPayload = {
  transcript: string;
  mode: ModeId;
  language: 'auto' | 'de' | 'en';
  instruction?: string;
  context?: string;
};

// Legacy payload type for backwards compatibility
export type PipelinePayload = {
  audio?: AudioData;
  mimeType?: string;
  mode: ModeId;
  language: 'auto' | 'de' | 'en';
  context?: string;
  transcriptOverride?: string;
};

export type OverlayLayout = 'compact' | 'expanded' | 'withCanvas';

// Chat types
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessageInput {
  role: ChatMessageRole;
  content: string;
}

export interface ChatResponse {
  message: string;
  detectedCommand?: {
    type: 'record' | 'mode_select' | 'help' | 'settings' | 'history' | 'none';
    mode?: ModeId;
    context?: string;
  };
}

// Intent Router types
export type IntentType =
  | 'create_artifact'
  | 'clarify'
  | 'record'
  | 'query'
  | 'settings'
  | 'history'
  | 'help'
  | 'chat'
  | 'list_projects'
  | 'create_project'
  | 'ambiguous_project'
  | 'list_contacts'
  | 'query_tasks';

export type ProjectAction = 'add_artifact' | 'switch_to' | 'update';

export interface IntentResult {
  intent: IntentType;
  mode?: ModeId;
  context?: string;
  response?: string;
  question?: string;
  missingField?: string;
  partialContext?: string;
  action?: ProjectAction; // For ambiguous_project intent
  confidence: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser | null;
  error?: string;
}

export interface SessionResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export interface SyncResult {
  success: boolean;
  pulled?: number;
  pushed?: number;
  error?: string;
}

// Memory types (for Project Memory System)
export interface TeamMember {
  name: string;
  role?: string;
  email?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  context?: string;
  stack?: string[];
  team?: TeamMember[];
  settings?: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  project_id: string;
  user_id: string;
  type: 'person' | 'concept' | 'decision' | 'deadline' | 'task' | 'tool' | 'custom';
  name: string;
  context?: string;
  aliases: string[];
  mentions: number;
  first_mentioned: string;
  last_mentioned: string;
  metadata?: Record<string, unknown>;
  related_entities: string[];
  created_at: string;
  updated_at: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  summary?: string;
  chunk_type: string;
  similarity: number;
  artifact_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ProjectContext {
  project: Project;
  recentEntities: Entity[];
  relevantMemories: MemorySearchResult[];
}

export interface ElectronAPI {
  toggleOverlay(): Promise<void>;
  hideOverlay(): Promise<void>;
  setOverlayLayout(layout: OverlayLayout): Promise<void>;
  // Window controls
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowFullscreen(): Promise<void>;
  windowIsMaximized(): Promise<boolean>;
  windowIsFullscreen(): Promise<boolean>;
  startTranscription(payload: TranscriptionPayload): Promise<{ runId: string }>;
  startEnrichment(payload: EnrichmentPayload): Promise<{ runId: string }>;
  startPipeline(payload: PipelinePayload): Promise<{ runId: string }>;
  cancelPipeline(runId: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  getHistory(limit: number): Promise<HistoryItem[]>;
  getHistoryItem(id: string): Promise<HistoryItem | null>;
  deleteHistoryItem(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  onPipelineEvent(cb: (evt: PipelineEvent) => void): () => void;
  onOverlayToggle(cb: () => void): () => void;
  sendChatMessage(messages: ChatMessageInput[]): Promise<ChatResponse>;
  routeIntent(message: string, history: ChatMessageInput[]): Promise<IntentResult>;
  // Auth
  authSignUp(email: string, password: string): Promise<AuthResult>;
  authSignIn(email: string, password: string): Promise<AuthResult>;
  authSignOut(): Promise<{ success: boolean; error?: string }>;
  authGetSession(): Promise<SessionResult>;
  // Sync
  syncPull(): Promise<SyncResult>;
  syncPush(): Promise<SyncResult>;
  syncFull(): Promise<SyncResult>;
  // Actions
  executeProposedAction(action: ProposedAction): Promise<ActionExecutionResult>;
  // Memory: Projects
  memoryListProjects(): Promise<Project[]>;
  memoryGetProject(projectId: string): Promise<Project | null>;
  memoryCreateProject(project: {
    name: string;
    description?: string;
    context?: string;
    stack?: string[];
    team?: TeamMember[];
    is_default?: boolean;
  }): Promise<Project>;
  memoryUpdateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>
  ): Promise<Project>;
  memoryDeleteProject(projectId: string): Promise<void>;
  memoryGetDefaultProject(): Promise<Project | null>;
  // Memory: Entities
  memoryListEntities(projectId: string, type?: Entity['type']): Promise<Entity[]>;
  memoryFindEntities(projectId: string, searchText: string, limit?: number): Promise<Entity[]>;
  memoryCreateEntity(entity: {
    project_id: string;
    type: Entity['type'];
    name: string;
    context?: string;
    aliases?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Entity>;
  memoryUpsertEntity(
    projectId: string,
    entity: { type: Entity['type']; name: string; context?: string; aliases?: string[] }
  ): Promise<Entity>;
  // Memory: Search & Context
  memorySearch(
    projectId: string,
    query: string,
    limit?: number,
    threshold?: number
  ): Promise<MemorySearchResult[]>;
  memoryBuildContext(
    projectId: string,
    transcript: string
  ): Promise<(ProjectContext & { formatted: string }) | null>;
  // Memory: Process artifact
  memoryProcessArtifact(
    projectId: string,
    artifactId: string,
    transcript: string,
    resultMarkdown: string
  ): Promise<void>;
  // Plan: Task status update
  updatePlanTaskStatus(
    historyItemId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
