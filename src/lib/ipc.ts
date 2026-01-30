import type {
  ElectronAPI,
  PipelinePayload,
  TranscriptionPayload,
  EnrichmentPayload,
  PipelineEvent,
  Settings,
  HistoryItem,
  OverlayLayout,
  ChatMessageInput,
  ChatResponse,
  IntentResult,
  AuthResult,
  SessionResult,
  SyncResult,
  Project,
  Entity,
  MemorySearchResult,
  ProjectContext,
  TeamMember,
  TaskStatus,
} from '../../electron/shared/types';
import type { ProposedAction, ActionExecutionResult } from '../../electron/shared/actions';

// Safe access to electron API
function getApi(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.api) {
    return window.api;
  }
  return null;
}

// Overlay controls
export async function toggleOverlay(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.toggleOverlay();
  }
}

export async function hideOverlay(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.hideOverlay();
  }
}

export async function setOverlayLayout(layout: OverlayLayout): Promise<void> {
  const api = getApi();
  if (api) {
    await api.setOverlayLayout(layout);
  }
}

// Window controls
export async function windowMinimize(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.windowMinimize();
  }
}

export async function windowMaximize(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.windowMaximize();
  }
}

export async function windowFullscreen(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.windowFullscreen();
  }
}

export async function windowIsMaximized(): Promise<boolean> {
  const api = getApi();
  if (api) {
    return api.windowIsMaximized();
  }
  return false;
}

export async function windowIsFullscreen(): Promise<boolean> {
  const api = getApi();
  if (api) {
    return api.windowIsFullscreen();
  }
  return false;
}

// New: Transcription-only
export async function startTranscription(
  payload: TranscriptionPayload
): Promise<{ runId: string } | null> {
  const api = getApi();
  if (api) {
    return api.startTranscription(payload);
  }
  return null;
}

// New: Enrichment-only
export async function startEnrichment(
  payload: EnrichmentPayload
): Promise<{ runId: string } | null> {
  const api = getApi();
  if (api) {
    return api.startEnrichment(payload);
  }
  return null;
}

// Legacy: Combined pipeline
export async function startPipeline(
  payload: PipelinePayload
): Promise<{ runId: string } | null> {
  const api = getApi();
  if (api) {
    return api.startPipeline(payload);
  }
  return null;
}

export async function cancelPipeline(runId: string): Promise<void> {
  const api = getApi();
  if (api) {
    await api.cancelPipeline(runId);
  }
}

// Clipboard
export async function copyToClipboard(text: string): Promise<void> {
  const api = getApi();
  if (api) {
    await api.copyToClipboard(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

// History
export async function getHistory(limit: number = 30): Promise<HistoryItem[]> {
  const api = getApi();
  if (api) {
    return api.getHistory(limit);
  }
  return [];
}

export async function getHistoryItem(id: string): Promise<HistoryItem | null> {
  const api = getApi();
  if (api) {
    return api.getHistoryItem(id);
  }
  return null;
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const api = getApi();
  if (api) {
    await api.deleteHistoryItem(id);
  }
}

export async function clearHistory(): Promise<void> {
  const api = getApi();
  if (api) {
    await api.clearHistory();
  }
}

// Settings
export async function getSettings(): Promise<Settings | null> {
  const api = getApi();
  if (api) {
    return api.getSettings();
  }
  return null;
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings | null> {
  const api = getApi();
  if (api) {
    return api.setSettings(patch);
  }
  return null;
}

// Event subscriptions
export function onPipelineEvent(
  callback: (event: PipelineEvent) => void
): () => void {
  const api = getApi();
  if (api) {
    return api.onPipelineEvent(callback);
  }
  return () => {};
}

export function onOverlayToggle(callback: () => void): () => void {
  const api = getApi();
  if (api) {
    return api.onOverlayToggle(callback);
  }
  return () => {};
}

// Chat
export async function sendChatMessage(
  messages: ChatMessageInput[]
): Promise<ChatResponse | null> {
  const api = getApi();
  if (api) {
    return api.sendChatMessage(messages);
  }
  return null;
}

// Intent Router
export async function routeIntent(
  message: string,
  history: ChatMessageInput[]
): Promise<IntentResult | null> {
  const api = getApi();
  if (api) {
    return api.routeIntent(message, history);
  }
  return null;
}

// Auth
export async function authSignUp(
  email: string,
  password: string
): Promise<AuthResult | null> {
  const api = getApi();
  if (api) {
    return api.authSignUp(email, password);
  }
  return null;
}

export async function authSignIn(
  email: string,
  password: string
): Promise<AuthResult | null> {
  const api = getApi();
  if (api) {
    return api.authSignIn(email, password);
  }
  return null;
}

export async function authSignOut(): Promise<{ success: boolean; error?: string } | null> {
  const api = getApi();
  if (api) {
    return api.authSignOut();
  }
  return null;
}

export async function authGetSession(): Promise<SessionResult | null> {
  const api = getApi();
  if (api) {
    return api.authGetSession();
  }
  return null;
}

// Sync
export async function syncPull(): Promise<SyncResult | null> {
  const api = getApi();
  if (api) {
    return api.syncPull();
  }
  return null;
}

export async function syncPush(): Promise<SyncResult | null> {
  const api = getApi();
  if (api) {
    return api.syncPush();
  }
  return null;
}

export async function syncFull(): Promise<SyncResult | null> {
  const api = getApi();
  if (api) {
    return api.syncFull();
  }
  return null;
}

// Actions
export async function executeProposedAction(
  action: ProposedAction
): Promise<ActionExecutionResult> {
  const api = getApi();
  if (api) {
    return api.executeProposedAction(action);
  }
  return { success: false, message: 'API nicht verfügbar' };
}

// Memory: Projects
export async function memoryListProjects(): Promise<Project[]> {
  const api = getApi();
  if (api) {
    return api.memoryListProjects();
  }
  return [];
}

export async function memoryGetProject(projectId: string): Promise<Project | null> {
  const api = getApi();
  if (api) {
    return api.memoryGetProject(projectId);
  }
  return null;
}

export async function memoryCreateProject(project: {
  name: string;
  description?: string;
  context?: string;
  stack?: string[];
  team?: TeamMember[];
  is_default?: boolean;
}): Promise<Project | null> {
  const api = getApi();
  if (api) {
    return api.memoryCreateProject(project);
  }
  return null;
}

export async function memoryUpdateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>
): Promise<Project | null> {
  const api = getApi();
  if (api) {
    return api.memoryUpdateProject(projectId, updates);
  }
  return null;
}

export async function memoryDeleteProject(projectId: string): Promise<void> {
  const api = getApi();
  if (api) {
    await api.memoryDeleteProject(projectId);
  }
}

export async function memoryGetDefaultProject(): Promise<Project | null> {
  const api = getApi();
  if (api) {
    return api.memoryGetDefaultProject();
  }
  return null;
}

// Memory: Entities
export async function memoryListEntities(
  projectId: string,
  type?: Entity['type']
): Promise<Entity[]> {
  const api = getApi();
  if (api) {
    return api.memoryListEntities(projectId, type);
  }
  return [];
}

export async function memoryFindEntities(
  projectId: string,
  searchText: string,
  limit?: number
): Promise<Entity[]> {
  const api = getApi();
  if (api) {
    return api.memoryFindEntities(projectId, searchText, limit);
  }
  return [];
}

export async function memoryCreateEntity(entity: {
  project_id: string;
  type: Entity['type'];
  name: string;
  context?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Entity | null> {
  const api = getApi();
  if (api) {
    return api.memoryCreateEntity(entity);
  }
  return null;
}

export async function memoryUpsertEntity(
  projectId: string,
  entity: { type: Entity['type']; name: string; context?: string; aliases?: string[] }
): Promise<Entity | null> {
  const api = getApi();
  if (api) {
    return api.memoryUpsertEntity(projectId, entity);
  }
  return null;
}

// Memory: Search & Context
export async function memorySearch(
  projectId: string,
  query: string,
  limit?: number,
  threshold?: number
): Promise<MemorySearchResult[]> {
  const api = getApi();
  if (api) {
    return api.memorySearch(projectId, query, limit, threshold);
  }
  return [];
}

export async function memoryBuildContext(
  projectId: string,
  transcript: string
): Promise<(ProjectContext & { formatted: string }) | null> {
  const api = getApi();
  if (api) {
    return api.memoryBuildContext(projectId, transcript);
  }
  return null;
}

// Memory: Process artifact
export async function memoryProcessArtifact(
  projectId: string,
  artifactId: string,
  transcript: string,
  resultMarkdown: string
): Promise<void> {
  const api = getApi();
  if (api) {
    await api.memoryProcessArtifact(projectId, artifactId, transcript, resultMarkdown);
  }
}

// Plan: Update task status
export async function updatePlanTaskStatus(
  historyItemId: string,
  taskId: string,
  status: TaskStatus
): Promise<{ success: boolean; error?: string }> {
  const api = getApi();
  if (api) {
    return api.updatePlanTaskStatus(historyItemId, taskId, status);
  }
  return { success: false, error: 'API not available' };
}
