import { contextBridge, ipcRenderer } from 'electron';
import type {
  PipelinePayload,
  TranscriptionPayload,
  EnrichmentPayload,
  PipelineEvent,
  Settings,
  HistoryItem,
  OverlayLayout,
  AudioData,
  ChatMessageInput,
  ChatResponse,
  IntentResult,
  AuthResult,
  SessionResult,
  SyncResult,
} from './shared/types';
import type { ProposedAction, ActionExecutionResult } from './shared/actions';
import type {
  Project,
  Entity,
  MemorySearchResult,
  ProjectContext,
  TeamMember,
} from './shared/types';

/**
 * Serialize audio data for IPC transport.
 * Electron IPC can handle ArrayBuffer and Uint8Array natively in recent versions,
 * but we use Uint8Array for maximum compatibility.
 */
function serializeAudioForIPC(audio: AudioData): Uint8Array | number[] {
  if (audio instanceof ArrayBuffer) {
    return new Uint8Array(audio);
  }
  if (audio instanceof Uint8Array) {
    return audio;
  }
  // Already a number[] (legacy format)
  return audio;
}

contextBridge.exposeInMainWorld('api', {
  toggleOverlay: (): Promise<void> => {
    return ipcRenderer.invoke('overlay:toggle');
  },

  hideOverlay: (): Promise<void> => {
    return ipcRenderer.invoke('overlay:hide');
  },

  setOverlayLayout: (layout: OverlayLayout): Promise<void> => {
    return ipcRenderer.invoke('overlay:setLayout', layout);
  },

  // Window controls
  windowMinimize: (): Promise<void> => {
    return ipcRenderer.invoke('window:minimize');
  },

  windowMaximize: (): Promise<void> => {
    return ipcRenderer.invoke('window:maximize');
  },

  windowFullscreen: (): Promise<void> => {
    return ipcRenderer.invoke('window:fullscreen');
  },

  windowIsMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:isMaximized');
  },

  windowIsFullscreen: (): Promise<boolean> => {
    return ipcRenderer.invoke('window:isFullscreen');
  },

  // Transcription-only
  startTranscription: (payload: TranscriptionPayload): Promise<{ runId: string }> => {
    const serializedPayload = {
      audio: serializeAudioForIPC(payload.audio),
      mimeType: payload.mimeType,
      language: payload.language,
    };
    return ipcRenderer.invoke('pipeline:transcribe', serializedPayload);
  },

  // Enrichment-only
  startEnrichment: (payload: EnrichmentPayload): Promise<{ runId: string }> => {
    return ipcRenderer.invoke('pipeline:enrich', payload);
  },

  // Legacy: Combined pipeline
  startPipeline: (payload: PipelinePayload): Promise<{ runId: string }> => {
    const serializedPayload = {
      ...payload,
      audio: payload.audio ? serializeAudioForIPC(payload.audio) : undefined,
    };
    return ipcRenderer.invoke('pipeline:start', serializedPayload);
  },

  cancelPipeline: (runId: string): Promise<void> => {
    return ipcRenderer.invoke('pipeline:cancel', runId);
  },

  copyToClipboard: (text: string): Promise<void> => {
    return ipcRenderer.invoke('clipboard:write', text);
  },

  getHistory: (limit: number): Promise<HistoryItem[]> => {
    return ipcRenderer.invoke('history:list', limit);
  },

  getHistoryItem: (id: string): Promise<HistoryItem | null> => {
    return ipcRenderer.invoke('history:get', id);
  },

  deleteHistoryItem: (id: string): Promise<void> => {
    return ipcRenderer.invoke('history:delete', id);
  },

  clearHistory: (): Promise<void> => {
    return ipcRenderer.invoke('history:clear');
  },

  getSettings: (): Promise<Settings> => {
    return ipcRenderer.invoke('settings:get');
  },

  setSettings: (patch: Partial<Settings>): Promise<Settings> => {
    return ipcRenderer.invoke('settings:set', patch);
  },

  onPipelineEvent: (callback: (event: PipelineEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: PipelineEvent) => {
      callback(event);
    };
    ipcRenderer.on('pipeline:event', handler);
    return () => {
      ipcRenderer.removeListener('pipeline:event', handler);
    };
  },

  onOverlayToggle: (callback: () => void): (() => void) => {
    const handler = () => {
      callback();
    };
    ipcRenderer.on('overlay:toggled', handler);
    return () => {
      ipcRenderer.removeListener('overlay:toggled', handler);
    };
  },

  sendChatMessage: (messages: ChatMessageInput[]): Promise<ChatResponse> => {
    return ipcRenderer.invoke('chat:send', messages);
  },

  routeIntent: (message: string, history: ChatMessageInput[]): Promise<IntentResult> => {
    return ipcRenderer.invoke('intent:route', message, history);
  },

  // Auth
  authSignUp: (email: string, password: string): Promise<AuthResult> => {
    return ipcRenderer.invoke('auth:signUp', email, password);
  },

  authSignIn: (email: string, password: string): Promise<AuthResult> => {
    return ipcRenderer.invoke('auth:signIn', email, password);
  },

  authSignOut: (): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('auth:signOut');
  },

  authGetSession: (): Promise<SessionResult> => {
    return ipcRenderer.invoke('auth:getSession');
  },

  // Sync
  syncPull: (): Promise<SyncResult> => {
    return ipcRenderer.invoke('sync:pull');
  },

  syncPush: (): Promise<SyncResult> => {
    return ipcRenderer.invoke('sync:push');
  },

  syncFull: (): Promise<SyncResult> => {
    return ipcRenderer.invoke('sync:full');
  },

  // Actions
  executeProposedAction: (action: ProposedAction): Promise<ActionExecutionResult> => {
    return ipcRenderer.invoke('action:execute', action);
  },

  // Memory: Projects
  memoryListProjects: (): Promise<Project[]> => {
    return ipcRenderer.invoke('memory:listProjects');
  },

  memoryGetProject: (projectId: string): Promise<Project | null> => {
    return ipcRenderer.invoke('memory:getProject', projectId);
  },

  memoryCreateProject: (project: {
    name: string;
    description?: string;
    context?: string;
    stack?: string[];
    team?: TeamMember[];
    is_default?: boolean;
  }): Promise<Project> => {
    return ipcRenderer.invoke('memory:createProject', project);
  },

  memoryUpdateProject: (
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>
  ): Promise<Project> => {
    return ipcRenderer.invoke('memory:updateProject', projectId, updates);
  },

  memoryDeleteProject: (projectId: string): Promise<void> => {
    return ipcRenderer.invoke('memory:deleteProject', projectId);
  },

  memoryGetDefaultProject: (): Promise<Project | null> => {
    return ipcRenderer.invoke('memory:getDefaultProject');
  },

  // Memory: Entities
  memoryListEntities: (
    projectId: string,
    type?: Entity['type']
  ): Promise<Entity[]> => {
    return ipcRenderer.invoke('memory:listEntities', projectId, type);
  },

  memoryFindEntities: (
    projectId: string,
    searchText: string,
    limit?: number
  ): Promise<Entity[]> => {
    return ipcRenderer.invoke('memory:findEntities', projectId, searchText, limit);
  },

  memoryCreateEntity: (entity: {
    project_id: string;
    type: Entity['type'];
    name: string;
    context?: string;
    aliases?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Entity> => {
    return ipcRenderer.invoke('memory:createEntity', entity);
  },

  memoryUpsertEntity: (
    projectId: string,
    entity: {
      type: Entity['type'];
      name: string;
      context?: string;
      aliases?: string[];
    }
  ): Promise<Entity> => {
    return ipcRenderer.invoke('memory:upsertEntity', projectId, entity);
  },

  // Memory: Search & Context
  memorySearch: (
    projectId: string,
    query: string,
    limit?: number,
    threshold?: number
  ): Promise<MemorySearchResult[]> => {
    return ipcRenderer.invoke('memory:search', projectId, query, limit, threshold);
  },

  memoryBuildContext: (
    projectId: string,
    transcript: string
  ): Promise<(ProjectContext & { formatted: string }) | null> => {
    return ipcRenderer.invoke('memory:buildContext', projectId, transcript);
  },

  // Memory: Process artifact
  memoryProcessArtifact: (
    projectId: string,
    artifactId: string,
    transcript: string,
    resultMarkdown: string
  ): Promise<void> => {
    return ipcRenderer.invoke('memory:processArtifact', projectId, artifactId, transcript, resultMarkdown);
  },

  // Plan: Update task status
  updatePlanTaskStatus: (
    historyItemId: string,
    taskId: string,
    status: string
  ): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('plan:updateTaskStatus', historyItemId, taskId, status);
  },
});
