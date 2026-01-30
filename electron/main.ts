// Load environment variables FIRST (before any other imports that might use them)
import dotenv from 'dotenv';
import path from 'path';

// Determine if we're in development or production
const isDev = process.env.NODE_ENV !== 'production' && !process.execPath.includes('VoxNote.app');

if (isDev) {
  // Development: load from project root
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
} else {
  // Production: environment variables should be set at build/runtime
  // Optional: allow userData env file for local installs
  // dotenv.config({ path: path.join(app.getPath('userData'), '.env.local') });
}

import { app, ipcMain, clipboard, protocol } from 'electron';
import { createOverlayWindow, toggleOverlay, hideOverlay, setOverlayLayout, minimizeWindow, maximizeWindow, toggleFullscreen, isWindowMaximized, isWindowFullscreen } from './services/window';
import { registerHotkey, unregisterAllHotkeys } from './services/hotkeys';
import { createTray, destroyTray } from './services/tray';
import { getSettings, setSettings } from './services/settings';
import { listHistory, getHistoryItem, deleteHistoryItem, clearHistory, updatePlanTaskStatus } from './services/history';
import { startPipeline, startTranscription, startEnrichment, cancelPipeline, sendChatMessage, routeIntent } from './services/pipeline';
import { initSupabase, signUp, signIn, signOut, getSession } from './services/supabase';
import { pullAndMerge, pushUnsynced, fullSync } from './services/sync';
import { executeProposedAction } from './services/action-executor';
import * as memoryService from './services/memory';
import type { PipelinePayload, TranscriptionPayload, EnrichmentPayload, Settings, OverlayLayout, AudioData, TaskStatus } from './shared/types';

// Register custom protocol scheme - MUST be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (process.platform === 'win32' && require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, which is fine
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    toggleOverlay();
  });
}

/**
 * Normalize audio data from IPC (can be Uint8Array, number[], or Buffer-like object)
 * to a format suitable for the pipeline.
 */
function normalizeIPCAudio(audio: unknown): AudioData {
  // Handle Uint8Array (preferred)
  if (audio instanceof Uint8Array) {
    return audio;
  }

  // Handle number[] (legacy fallback)
  if (Array.isArray(audio)) {
    return audio as number[];
  }

  // Handle Buffer-like objects (from IPC serialization)
  if (audio && typeof audio === 'object') {
    const obj = audio as Record<string, unknown>;

    // Check for Buffer serialization format: { type: 'Buffer', data: [...] }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[]);
    }

    // Handle plain object with numeric keys (edge case from IPC)
    const keys = Object.keys(obj);
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
      const arr = new Uint8Array(keys.length);
      for (let i = 0; i < keys.length; i++) {
        arr[i] = obj[String(i)] as number;
      }
      return arr;
    }
  }

  // Fallback: empty
  return new Uint8Array(0);
}

// Setup IPC handlers
function setupIpcHandlers(): void {
  // Overlay
  ipcMain.handle('overlay:toggle', async () => {
    toggleOverlay();
  });

  ipcMain.handle('overlay:hide', async () => {
    hideOverlay();
  });

  ipcMain.handle('overlay:setLayout', async (_, layout: OverlayLayout) => {
    setOverlayLayout(layout);
  });

  // Window controls
  ipcMain.handle('window:minimize', async () => {
    minimizeWindow();
  });

  ipcMain.handle('window:maximize', async () => {
    maximizeWindow();
  });

  ipcMain.handle('window:fullscreen', async () => {
    toggleFullscreen();
  });

  ipcMain.handle('window:isMaximized', async () => {
    return isWindowMaximized();
  });

  ipcMain.handle('window:isFullscreen', async () => {
    return isWindowFullscreen();
  });

  // Transcription-only
  ipcMain.handle('pipeline:transcribe', async (_, payload: { audio?: unknown; mimeType: string; language: string }) => {
    const convertedPayload: TranscriptionPayload = {
      audio: normalizeIPCAudio(payload.audio),
      mimeType: payload.mimeType,
      language: payload.language as TranscriptionPayload['language'],
    };
    return startTranscription(convertedPayload);
  });

  // Enrichment-only
  ipcMain.handle('pipeline:enrich', async (_, payload: { transcript: string; mode: string; language: string; instruction?: string; context?: string }) => {
    const convertedPayload: EnrichmentPayload = {
      transcript: payload.transcript,
      mode: payload.mode as EnrichmentPayload['mode'],
      language: payload.language as EnrichmentPayload['language'],
      instruction: payload.instruction,
      context: payload.context,
    };
    return startEnrichment(convertedPayload);
  });

  // Legacy: Combined pipeline
  ipcMain.handle('pipeline:start', async (_, payload: { audio?: unknown; mimeType?: string; mode: string; language: string; context?: string; transcriptOverride?: string }) => {
    const convertedPayload: PipelinePayload = {
      audio: payload.audio ? normalizeIPCAudio(payload.audio) : undefined,
      mimeType: payload.mimeType,
      mode: payload.mode as PipelinePayload['mode'],
      language: payload.language as PipelinePayload['language'],
      context: payload.context,
      transcriptOverride: payload.transcriptOverride,
    };
    return startPipeline(convertedPayload);
  });

  ipcMain.handle('pipeline:cancel', async (_, runId: string) => {
    cancelPipeline(runId);
  });

  // Chat
  ipcMain.handle('chat:send', async (_, messages: Array<{ role: string; content: string }>) => {
    return sendChatMessage(messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>);
  });

  // Intent Router
  ipcMain.handle('intent:route', async (_, message: string, history: Array<{ role: string; content: string }>) => {
    return routeIntent(message, history as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>);
  });

  // Auth
  ipcMain.handle('auth:signUp', async (_, email: string, password: string) => {
    return signUp(email, password);
  });

  ipcMain.handle('auth:signIn', async (_, email: string, password: string) => {
    return signIn(email, password);
  });

  ipcMain.handle('auth:signOut', async () => {
    return signOut();
  });

  ipcMain.handle('auth:getSession', async () => {
    const result = await getSession();
    return {
      user: result.user ? { id: result.user.id, email: result.user.email || '' } : null,
      isAuthenticated: !!result.user,
    };
  });

  // Sync
  ipcMain.handle('sync:pull', async () => {
    return pullAndMerge();
  });

  ipcMain.handle('sync:push', async () => {
    return pushUnsynced();
  });

  ipcMain.handle('sync:full', async () => {
    return fullSync();
  });

  // Clipboard
  ipcMain.handle('clipboard:write', async (_, text: string) => {
    clipboard.writeText(text);
  });

  // History
  ipcMain.handle('history:list', async (_, limit: number) => {
    return listHistory(limit);
  });

  ipcMain.handle('history:get', async (_, id: string) => {
    return getHistoryItem(id);
  });

  ipcMain.handle('history:delete', async (_, id: string) => {
    deleteHistoryItem(id);
  });

  ipcMain.handle('history:clear', async () => {
    clearHistory();
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return getSettings();
  });

  ipcMain.handle('settings:set', async (_, patch: Partial<Settings>) => {
    const oldSettings = getSettings();
    const newSettings = setSettings(patch);

    if (patch.hotkey && patch.hotkey !== oldSettings.hotkey) {
      registerHotkey(newSettings.hotkey, toggleOverlay);
    }

    return newSettings;
  });

  // Actions
  ipcMain.handle('action:execute', async (_, action: unknown) => {
    return executeProposedAction(action);
  });

  // Memory: Projects
  ipcMain.handle('memory:listProjects', async () => {
    return memoryService.listProjects();
  });

  ipcMain.handle('memory:getProject', async (_, projectId: string) => {
    return memoryService.getProject(projectId);
  });

  ipcMain.handle('memory:createProject', async (_, project: Parameters<typeof memoryService.createProject>[0]) => {
    return memoryService.createProject(project);
  });

  ipcMain.handle('memory:updateProject', async (_, projectId: string, updates: Parameters<typeof memoryService.updateProject>[1]) => {
    return memoryService.updateProject(projectId, updates);
  });

  ipcMain.handle('memory:deleteProject', async (_, projectId: string) => {
    return memoryService.deleteProject(projectId);
  });

  ipcMain.handle('memory:getDefaultProject', async () => {
    return memoryService.getDefaultProject();
  });

  // Memory: Entities
  ipcMain.handle('memory:listEntities', async (_, projectId: string, type?: string) => {
    return memoryService.listEntities(projectId, type as memoryService.Entity['type']);
  });

  ipcMain.handle('memory:findEntities', async (_, projectId: string, searchText: string, limit?: number) => {
    return memoryService.findEntities(projectId, searchText, limit);
  });

  ipcMain.handle('memory:createEntity', async (_, entity: Parameters<typeof memoryService.createEntity>[0]) => {
    return memoryService.createEntity(entity);
  });

  ipcMain.handle('memory:upsertEntity', async (_, projectId: string, entity: Parameters<typeof memoryService.upsertEntity>[1]) => {
    return memoryService.upsertEntity(projectId, entity);
  });

  // Memory: Search & Context
  ipcMain.handle('memory:search', async (_, projectId: string, query: string, limit?: number, threshold?: number) => {
    return memoryService.searchMemory(projectId, query, limit, threshold);
  });

  ipcMain.handle('memory:buildContext', async (_, projectId: string, transcript: string) => {
    const context = await memoryService.buildProjectContext(projectId, transcript);
    if (!context) return null;
    return {
      ...context,
      formatted: memoryService.formatContextForLLM(context),
    };
  });

  // Memory: Process artifact
  ipcMain.handle('memory:processArtifact', async (_, projectId: string, artifactId: string, transcript: string, resultMarkdown: string) => {
    return memoryService.processArtifactForMemory(projectId, artifactId, transcript, resultMarkdown);
  });

  // Plan: Update task status
  ipcMain.handle('plan:updateTaskStatus', async (_, historyItemId: string, taskId: string, status: TaskStatus) => {
    return updatePlanTaskStatus(historyItemId, taskId, status);
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Initialize Supabase
  initSupabase();

  setupIpcHandlers();
  createOverlayWindow();

  const settings = getSettings();
  registerHotkey(settings.hotkey, toggleOverlay);

  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  toggleOverlay();
});

app.on('will-quit', () => {
  unregisterAllHotkeys();
  destroyTray();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
