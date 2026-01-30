import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  ModeId,
  Settings,
  HistoryItem,
  EnrichedResult,
  PipelineEvent,
  PipelineErrorCode,
  IntentType,
  Project,
  ProjectAction,
} from '../../electron/shared/types';
import type { ProposedAction, ActionExecutionResult } from '../../electron/shared/actions';
import * as ipc from './ipc';

// ============================================
// PROJECT NAME MATCHING UTILITIES
// ============================================

/**
 * Normalize a project name for comparison
 * - lowercase, trim, remove punctuation
 * - collapse multiple spaces
 * - remove common stopwords (app, projekt, application, etc.)
 */
function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, ' ')  // punctuation to spaces
    .replace(/\s+/g, ' ')       // collapse spaces
    .replace(/\b(app|application|projekt|project|zur|für|von|the|a|an)\b/gi, '')
    .trim();
}

/**
 * Calculate similarity between two strings (Jaccard index on words)
 * Returns 0-1 where 1 is identical
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeProjectName(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalizeProjectName(b).split(' ').filter(Boolean));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Find the most similar project by name
 * Returns the project if similarity >= threshold, otherwise null
 */
function findSimilarProject(projects: Project[], name: string, threshold = 0.6): Project | null {
  let bestMatch: Project | null = null;
  let bestScore = 0;

  for (const project of projects) {
    const score = calculateSimilarity(project.name, name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = project;
    }
  }

  return bestMatch;
}

// Chat types
export type ChatRole = 'system' | 'user' | 'assistant';

export type MessageKind = 'status' | 'transcript' | 'question' | 'artifact' | 'text' | 'error';

// Clarification types for stable slot-filling
export type ClarificationKind = 'time' | 'recipient' | 'project' | 'person' | 'details' | 'mode';

export interface PendingClarification {
  id: string;
  question: string;
  kind: ClarificationKind;
  options?: string[];
  resumePayload: {
    intent: IntentType;
    mode?: ModeId;
    transcript: string;
    partialContext?: string;
  };
}

/**
 * Pending disambiguation for project-related intents.
 * When user says "add to the project" without specifying which project,
 * we store the intended action so it can resume after project selection.
 */
export interface PendingDisambiguation {
  id: string;
  action: ProjectAction;
  context?: string; // What user wanted to do
  transcript?: string; // Original transcript if any
  mode?: ModeId; // If we know the mode
}

/**
 * Detect clarification kind from missing field or question
 */
function detectClarificationKind(missingField?: string): ClarificationKind {
  if (!missingField) return 'details';
  const field = missingField.toLowerCase();
  if (field.includes('time') || field.includes('when') || field.includes('wann') || field.includes('uhrzeit')) {
    return 'time';
  }
  if (field.includes('recipient') || field.includes('to') || field.includes('an wen') || field.includes('empfänger')) {
    return 'recipient';
  }
  if (field.includes('project') || field.includes('projekt')) {
    return 'project';
  }
  if (field.includes('person') || field.includes('who') || field.includes('wer')) {
    return 'person';
  }
  if (field.includes('mode') || field.includes('type') || field.includes('art')) {
    return 'mode';
  }
  return 'details';
}

export type SuggestedAction = {
  id: string;
  label: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  kind: MessageKind;
  createdAt: number;
  suggestedActions?: SuggestedAction[];
  isStreaming?: boolean;
  errorCode?: PipelineErrorCode;
  mode?: ModeId; // For artifact messages
  data?: unknown; // Structured data for plan mode, etc.
};

export type Phase =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'awaiting_action'
  | 'awaiting_context'
  | 'enriching'
  | 'done'
  | 'error'
  | 'cancelled';

// Mode actions for suggestions
export const MODE_ACTIONS: SuggestedAction[] = [
  { id: 'meeting', label: 'Meeting-Notiz' },
  { id: 'tasks', label: 'Aufgaben' },
  { id: 'email', label: 'E-Mail' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'devnote', label: 'Dev Note' },
  { id: 'clean', label: 'Bereinigen' },
  { id: 'reminder', label: 'Erinnerung' },
  { id: 'plan', label: 'Projektplan' },
];

// Mode-specific success intros
const MODE_INTROS: Record<ModeId, string> = {
  meeting: '✅ Deine **Meeting-Zusammenfassung** wurde erstellt:\n\n---\n\n',
  tasks: '✅ Deine **Aufgabenliste** wurde erstellt:\n\n---\n\n',
  email: '✅ Dein **E-Mail-Entwurf** wurde erstellt:\n\n---\n\n',
  ticket: '✅ Dein **Ticket** wurde erstellt:\n\n---\n\n',
  devnote: '✅ Deine **Dev-Notiz** wurde erstellt:\n\n---\n\n',
  clean: '✅ Dein **bereinigtes Transkript**:\n\n---\n\n',
  reminder: '✅ Deine **Erinnerung** wurde erstellt:\n\n---\n\n',
  plan: '✅ Dein **Projektplan** wurde erstellt:\n\n---\n\n',
};

// Error action suggestions
// Note: MISSING_API_KEY is now a system config error (no user action possible)
const ERROR_ACTIONS: Record<PipelineErrorCode, SuggestedAction[]> = {
  MISSING_API_KEY: [], // System config error - user cannot fix via UI
  RATE_LIMIT: [{ id: 'retry', label: 'Erneut versuchen' }],
  NETWORK: [{ id: 'retry', label: 'Erneut versuchen' }],
  INVALID_AUDIO_FORMAT: [{ id: 'retry', label: 'Nochmal aufnehmen' }],
  AUDIO_TOO_SHORT: [],
  CANCELLED: [],
  UNKNOWN: [{ id: 'retry', label: 'Erneut versuchen' }],
};

interface AppState {
  // Phase
  phase: Phase;

  // Chat
  messages: ChatMessage[];
  draftText: string;

  // Pipeline state
  pendingTranscript: string | null;
  selectedMode: ModeId | null;
  instruction: string | null;
  activeRunId: string | null;
  lastArtifactMarkdown: string | null;
  lastErrorCode: PipelineErrorCode | null;

  // Clarification State Machine (M1)
  pendingClarification: PendingClarification | null;

  // Project Context (M2)
  activeProjectId: string | null;
  projects: Project[];
  projectsLoading: boolean;
  projectSwitcherOpen: boolean;
  projectsPanelOpen: boolean;

  // Project Disambiguation (M4)
  pendingDisambiguation: PendingDisambiguation | null;

  // Contacts Panel (M5)
  contactsPanelOpen: boolean;

  // Proposed Actions
  pendingActions: ProposedAction[];
  actionConfirmOpen: boolean;
  confirmingAction: ProposedAction | null;
  actionExecuting: boolean;

  // Recording
  isRecording: boolean;
  recordingDuration: number;

  // UI
  historyOpen: boolean;
  settingsOpen: boolean;
  activeHistoryId: string | null;

  // Data
  settings: Settings | null;
  historyItems: HistoryItem[];
  errorMessage: string | null;

  // Language
  language: 'auto' | 'de' | 'en';

  // Actions
  setPhase: (phase: Phase) => void;
  setDraftText: (text: string) => void;
  setLanguage: (language: 'auto' | 'de' | 'en') => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'createdAt'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;

  // Recording
  setIsRecording: (isRecording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  startRecording: () => void;

  // Pipeline
  setActiveRunId: (runId: string | null) => void;
  setPendingTranscript: (transcript: string | null) => void;
  setSelectedMode: (mode: ModeId | null) => void;
  activateModeWithFeedback: (mode: ModeId) => void;
  setInstruction: (instruction: string | null) => void;
  setLastArtifactMarkdown: (markdown: string | null) => void;

  // History UI
  toggleHistory: () => void;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveHistoryId: (id: string | null) => void;

  // Clarification State Machine (M1)
  setClarification: (clarification: PendingClarification | null) => void;
  resolveClarification: (answer: string) => Promise<void>;

  // Project Context (M2)
  setActiveProjectId: (id: string | null) => void;
  loadProjects: () => Promise<void>;
  createProject: (project: { name: string; description?: string; is_default?: boolean }) => Promise<Project | null>;
  findOrCreateProject: (name: string, description?: string) => Promise<Project | null>;
  setActiveProject: (projectId: string | null) => Promise<void>;
  setProjectSwitcherOpen: (open: boolean) => void;
  setProjectsPanelOpen: (open: boolean) => void;

  // Project Disambiguation (M4)
  setPendingDisambiguation: (disambiguation: PendingDisambiguation | null) => void;
  resolveDisambiguation: (projectId: string) => Promise<void>;

  // Contacts Panel (M5)
  setContactsPanelOpen: (open: boolean) => void;

  // Async actions
  loadSettings: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  loadHistoryList: () => Promise<void>;
  openHistoryItem: (item: HistoryItem) => void;
  deleteHistoryEntry: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;

  // Flow actions
  handleTranscriptReceived: (transcript: string) => void;
  handleActionSelected: (actionId: string) => void;
  handleUserMessage: (text: string) => void;
  handleEnrichmentResult: (result: EnrichedResult) => void;
  handleError: (message: string, code?: PipelineErrorCode) => void;
  handleCancelled: () => void;
  startEnrichment: () => Promise<void>;
  retryLastAction: () => void;

  // Pipeline events
  subscribeToPipelineEvents: () => () => void;

  // Actions
  setPendingActions: (actions: ProposedAction[]) => void;
  openActionConfirm: (action: ProposedAction) => void;
  closeActionConfirm: () => void;
  executeAction: (action: ProposedAction) => Promise<ActionExecutionResult>;

  // Plan task tracking
  togglePlanTask: (messageId: string, taskId: string) => Promise<void>;

  // Reset
  resetConversation: () => void;
}

const defaultSettings: Settings = {
  hotkey: 'CommandOrControl+Shift+Space',
  saveHistory: true,
  defaultMode: 'meeting',
  language: 'auto',
  openaiApiKey: undefined,
  openaiTranscribeModel: 'whisper-1',
  openaiChatModel: 'gpt-4o-mini',
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  phase: 'idle',
  messages: [],
  draftText: '',
  pendingTranscript: null,
  selectedMode: null,
  instruction: null,
  activeRunId: null,
  lastArtifactMarkdown: null,
  lastErrorCode: null,
  // Clarification State Machine (M1)
  pendingClarification: null,
  // Project Context (M2)
  activeProjectId: null,
  projects: [],
  projectsLoading: false,
  projectSwitcherOpen: false,
  projectsPanelOpen: false,
  // Project Disambiguation (M4)
  pendingDisambiguation: null,
  // Contacts Panel (M5)
  contactsPanelOpen: false,
  // Proposed Actions
  pendingActions: [],
  actionConfirmOpen: false,
  confirmingAction: null,
  actionExecuting: false,
  isRecording: false,
  recordingDuration: 0,
  historyOpen: false,
  settingsOpen: false,
  activeHistoryId: null,
  settings: null,
  historyItems: [],
  errorMessage: null,
  language: 'auto',

  // Simple setters
  setPhase: (phase) => set({ phase }),
  setDraftText: (draftText) => set({ draftText }),
  setLanguage: (language) => set({ language }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  setActiveRunId: (activeRunId) => set({ activeRunId }),
  setPendingTranscript: (pendingTranscript) => set({ pendingTranscript }),
  setSelectedMode: (selectedMode) => set({ selectedMode }),
  activateModeWithFeedback: (mode) => {
    const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;
    set({ selectedMode: mode });
    get().addMessage({
      role: 'assistant',
      content: `**${modeLabel}** Modus aktiviert. Halte Space zum Sprechen oder tippe deine Nachricht.`,
      kind: 'status',
    });
  },
  setInstruction: (instruction) => set({ instruction }),
  setLastArtifactMarkdown: (lastArtifactMarkdown) => set({ lastArtifactMarkdown }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setActiveHistoryId: (activeHistoryId) => set({ activeHistoryId }),

  // Message management
  addMessage: (msg) => {
    const id = uuidv4();
    const message: ChatMessage = {
      ...msg,
      id,
      createdAt: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return id;
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  },

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    }));
  },

  clearMessages: () => set({ messages: [] }),

  // Recording
  startRecording: () => {
    set({
      isRecording: true,
      phase: 'recording',
      recordingDuration: 0,
      errorMessage: null,
      lastErrorCode: null,
    });
  },

  // History UI
  toggleHistory: async () => {
    const { historyOpen, messages } = get();
    const newOpen = !historyOpen;
    set({ historyOpen: newOpen });

    if (newOpen) {
      // Opening history: use withCanvas to show side panel without squishing chat
      await ipc.setOverlayLayout('withCanvas');
    } else if (messages.length === 0) {
      // Closing with no messages: go compact
      await ipc.setOverlayLayout('compact');
    } else {
      // Closing with messages: go expanded (not withCanvas)
      await ipc.setOverlayLayout('expanded');
    }
  },

  // ============================================
  // CLARIFICATION STATE MACHINE (M1)
  // ============================================

  setClarification: (clarification) => set({ pendingClarification: clarification }),

  /**
   * Resolve a pending clarification by combining the answer with the resume payload.
   * This bypasses the Intent Router and directly starts enrichment.
   */
  resolveClarification: async (answer: string) => {
    const { pendingClarification, addMessage, language } = get();
    if (!pendingClarification) return;

    const { resumePayload } = pendingClarification;

    // Combine answer with existing context
    const combinedContext = resumePayload.partialContext
      ? `${resumePayload.partialContext}. ${answer}`
      : answer;

    // Clear clarification FIRST to prevent re-entry
    set({ pendingClarification: null });

    // Determine mode (from payload or default to meeting)
    const mode = resumePayload.mode || 'meeting';
    const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;

    // Show status
    addMessage({
      role: 'assistant',
      content: `Erstelle ${modeLabel}...`,
      kind: 'status',
      isStreaming: true,
    });

    set({
      phase: 'enriching',
      selectedMode: mode,
      instruction: combinedContext,
    });

    // Start enrichment directly - NO LLM re-routing
    const response = await ipc.startEnrichment({
      transcript: resumePayload.transcript || answer,
      mode,
      language,
      instruction: combinedContext,
    });

    if (response) {
      set({ activeRunId: response.runId });
    }
  },

  // ============================================
  // PROJECT CONTEXT (M2)
  // ============================================

  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setProjectSwitcherOpen: (open) => set({ projectSwitcherOpen: open }),
  setProjectsPanelOpen: (open) => set({ projectsPanelOpen: open }),

  // Contacts Panel (M5)
  setContactsPanelOpen: (open) => set({ contactsPanelOpen: open }),

  loadProjects: async () => {
    set({ projectsLoading: true });
    try {
      const projects = await ipc.memoryListProjects();
      const defaultProject = projects.find((p) => p.is_default);
      set({
        projects,
        activeProjectId: defaultProject?.id || null,
        projectsLoading: false,
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      set({ projectsLoading: false });
    }
  },

  createProject: async (project) => {
    try {
      const created = await ipc.memoryCreateProject(project);
      if (created) {
        // Reload projects to get updated list
        await get().loadProjects();
        // If this was set as default, update active project
        if (project.is_default) {
          set({ activeProjectId: created.id });
        }
        return created;
      }
      return null;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  },

  findOrCreateProject: async (name, description) => {
    const { projects, activeProjectId } = get();

    // First, check if we already have an active project - prefer using it
    const activeProject = projects.find((p) => p.id === activeProjectId);
    if (activeProject) {
      // Check if the new name is similar to active project
      const similarity = calculateSimilarity(activeProject.name, name);
      if (similarity >= 0.5) {
        console.log(`[Store] Using active project "${activeProject.name}" (similarity: ${similarity.toFixed(2)})`);
        return activeProject;
      }
    }

    // Check for similar existing projects
    const similar = findSimilarProject(projects, name);
    if (similar) {
      console.log(`[Store] Found similar project "${similar.name}" for "${name}"`);
      return similar;
    }

    // No match found - create new project
    console.log(`[Store] Creating new project "${name}"`);
    return get().createProject({ name, description });
  },

  setActiveProject: async (projectId) => {
    if (!projectId) {
      set({ activeProjectId: null });
      return;
    }

    try {
      // Update project to be default
      await ipc.memoryUpdateProject(projectId, { is_default: true });
      set({ activeProjectId: projectId });
      // Reload to update is_default flags
      await get().loadProjects();
    } catch (error) {
      console.error('Failed to set active project:', error);
    }
  },

  // ============================================
  // PROJECT DISAMBIGUATION (M4)
  // ============================================

  setPendingDisambiguation: (disambiguation) => set({ pendingDisambiguation: disambiguation }),

  /**
   * Resolve a pending disambiguation by selecting a project.
   * This continues the original user intent with the selected project context.
   */
  resolveDisambiguation: async (projectId: string) => {
    const { pendingDisambiguation, addMessage, projects, language } = get();
    if (!pendingDisambiguation) return;

    const { action, context, transcript, mode } = pendingDisambiguation;

    // Clear disambiguation FIRST
    set({ pendingDisambiguation: null, projectSwitcherOpen: false });

    // Set the selected project as active
    await get().setActiveProject(projectId);

    // Find project name for feedback
    const project = projects.find((p) => p.id === projectId);
    const projectName = project?.name || 'Projekt';

    switch (action) {
      case 'add_artifact':
        // User wanted to add something to the project
        if (transcript && mode) {
          // We have a transcript and mode - start enrichment
          const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;
          addMessage({
            role: 'assistant',
            content: `Erstelle ${modeLabel} für "${projectName}"...`,
            kind: 'status',
            isStreaming: true,
          });

          set({ phase: 'enriching', selectedMode: mode, instruction: context });

          const response = await ipc.startEnrichment({
            transcript,
            mode,
            language,
            instruction: context,
          });

          if (response) {
            set({ activeRunId: response.runId });
          }
        } else {
          // Just confirm project switch
          addMessage({
            role: 'assistant',
            content: `Projekt "${projectName}" ausgewählt. Was möchtest du hinzufügen?`,
            kind: 'text',
          });
          set({ phase: 'idle' });
        }
        break;

      case 'switch_to':
        // User just wanted to switch projects
        addMessage({
          role: 'assistant',
          content: `Zu Projekt "${projectName}" gewechselt.`,
          kind: 'text',
        });
        set({ phase: 'idle' });
        break;

      case 'update':
        // User wanted to update the project
        addMessage({
          role: 'assistant',
          content: `Projekt "${projectName}" ausgewählt. Was möchtest du aktualisieren?`,
          kind: 'text',
        });
        set({ phase: 'idle' });
        break;

      default:
        addMessage({
          role: 'assistant',
          content: `Projekt "${projectName}" ausgewählt.`,
          kind: 'text',
        });
        set({ phase: 'idle' });
    }
  },

  // Async actions
  loadSettings: async () => {
    const settings = await ipc.getSettings();
    if (settings) {
      set({
        settings,
        language: settings.language,
      });
    }
  },

  saveSettings: async (patch) => {
    const result = await ipc.setSettings(patch);
    if (result) {
      set({ settings: result });
    }
  },

  loadHistoryList: async () => {
    const historyItems = await ipc.getHistory(30);
    set({ historyItems });
  },

  openHistoryItem: (item) => {
    const { addMessage, clearMessages } = get();
    clearMessages();

    // Add system context
    const modeLabel = MODE_ACTIONS.find((a) => a.id === item.mode)?.label || item.mode;
    addMessage({
      role: 'system',
      content: `${modeLabel} · ${new Date(item.createdAt).toLocaleString()}${item.instruction ? ` · ${item.instruction}` : ''}`,
      kind: 'status',
    });

    // Add user transcript
    addMessage({
      role: 'user',
      content: item.transcript,
      kind: 'transcript',
    });

    // Add assistant artifact
    addMessage({
      role: 'assistant',
      content: item.result.markdown,
      kind: 'artifact',
      mode: item.mode,
    });

    set({
      phase: 'done',
      lastArtifactMarkdown: item.result.markdown,
      pendingTranscript: item.transcript,
      selectedMode: item.mode,
      instruction: item.instruction || null,
      activeHistoryId: item.id,
      historyOpen: false,
    });

    // Layout is now managed by page.tsx useEffect based on messages.length
  },

  deleteHistoryEntry: async (id) => {
    await ipc.deleteHistoryItem(id);
    const historyItems = get().historyItems.filter((item) => item.id !== id);
    set({ historyItems });
  },

  clearAllHistory: async () => {
    await ipc.clearHistory();
    set({ historyItems: [] });
  },

  // Flow handlers
  handleTranscriptReceived: async (transcript) => {
    const { addMessage, language, messages } = get();

    // Add user message with transcript (no action buttons)
    addMessage({
      role: 'user',
      content: transcript,
      kind: 'transcript',
    });

    // Set pending transcript
    set({
      pendingTranscript: transcript,
      activeRunId: null,
    });

    // Build conversation history for context (last 10 messages)
    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Auto-detect mode using intent router
    try {
      addMessage({
        role: 'assistant',
        content: 'Analysiere...',
        kind: 'status',
        isStreaming: true,
      });

      const intent = await ipc.routeIntent(transcript, recentHistory);

      // Remove the "Analysiere" status message
      const currentMessages = get().messages;
      const { removeMessage } = get();
      const statusMsg = currentMessages.find((m) => m.kind === 'status' && m.isStreaming && m.content === 'Analysiere...');
      if (statusMsg) {
        removeMessage(statusMsg.id);
      }

      if (!intent) {
        // No intent - show mode selector
        set({ phase: 'awaiting_action' });
        return;
      }

      // Handle different intents
      switch (intent.intent) {
        case 'create_artifact':
          if (intent.mode) {
            // Auto-detected mode - start enrichment immediately
            const mode = intent.mode as ModeId;
            const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;

            set({ selectedMode: mode, instruction: intent.context || null });

            addMessage({
              role: 'assistant',
              content: `Erstelle ${modeLabel}...`,
              kind: 'status',
              isStreaming: true,
            });

            set({ phase: 'enriching' });

            const response = await ipc.startEnrichment({
              transcript,
              mode,
              language,
              instruction: intent.context || undefined,
            });

            if (response) {
              set({ activeRunId: response.runId });
            }
          } else {
            set({ phase: 'awaiting_action' });
          }
          break;

        case 'clarify':
          // Bot needs more info - SET CLARIFICATION STATE for reliable slot-filling
          {
            const clarificationKind = detectClarificationKind(intent.missingField);
            get().setClarification({
              id: uuidv4(),
              question: intent.question || 'Kannst du mir mehr Details geben?',
              kind: clarificationKind,
              resumePayload: {
                intent: 'create_artifact',
                mode: intent.mode as ModeId | undefined,
                transcript: transcript,
                partialContext: intent.partialContext,
              },
            });
            addMessage({
              role: 'assistant',
              content: intent.question || 'Kannst du mir mehr Details geben?',
              kind: 'question',
            });
            set({ phase: 'awaiting_context' });
          }
          break;

        case 'chat':
        case 'help':
        case 'query':
          // Conversational response - show bot response
          addMessage({
            role: 'assistant',
            content: intent.response || 'Wie kann ich dir helfen?',
            kind: 'text',
          });
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'record':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Halte Space gedrückt um aufzunehmen.',
            kind: 'text',
          });
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'settings':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Ich öffne die Einstellungen für dich.',
            kind: 'text',
          });
          get().setSettingsOpen(true);
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'history':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Ich öffne die History für dich.',
            kind: 'text',
          });
          get().toggleHistory();
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'list_projects':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Ich öffne die Projektübersicht für dich.',
            kind: 'text',
          });
          get().setProjectSwitcherOpen(true);
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'create_project':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Ich öffne den Dialog zum Erstellen eines neuen Projekts.',
            kind: 'text',
          });
          get().setProjectSwitcherOpen(true);
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'list_contacts':
          addMessage({
            role: 'assistant',
            content: intent.response || 'Ich öffne deine Kontakte.',
            kind: 'text',
          });
          get().setContactsPanelOpen(true);
          set({ phase: 'idle', pendingTranscript: null });
          break;

        case 'ambiguous_project':
          // User said something like "add to the project" without specifying which one
          // Store the disambiguation context and open project switcher
          {
            const disambiguationAction = intent.action || 'add_artifact';
            get().setPendingDisambiguation({
              id: uuidv4(),
              action: disambiguationAction,
              context: intent.context,
              transcript: transcript,
              mode: intent.mode as ModeId | undefined,
            });
            addMessage({
              role: 'assistant',
              content: intent.response || 'Welches Projekt meinst du?',
              kind: 'question',
            });
            get().setProjectSwitcherOpen(true);
            set({ phase: 'idle', pendingTranscript: null });
          }
          break;

        default:
          // Unknown intent - show mode selector
          set({ phase: 'awaiting_action' });
          break;
      }
    } catch (error) {
      console.error('Auto-detect mode error:', error);
      // Fallback: show mode selector
      set({ phase: 'awaiting_action' });
    }
  },

  handleActionSelected: async (actionId) => {
    const { pendingTranscript, language, addMessage, setSettingsOpen } = get();

    // Handle special actions
    if (actionId === 'open_settings') {
      setSettingsOpen(true);
      return;
    }

    if (actionId === 'retry') {
      get().retryLastAction();
      return;
    }

    // Handle mode selection
    const mode = actionId as ModeId;
    set({ selectedMode: mode });

    // Check if we need context for certain modes
    if ((mode === 'ticket' || mode === 'email') && !get().instruction) {
      addMessage({
        role: 'assistant',
        content: mode === 'ticket'
          ? 'Für welches Projekt ist das Ticket?'
          : 'An wen soll die E-Mail gehen?',
        kind: 'question',
      });
      set({ phase: 'awaiting_context' });
      return;
    }

    // Start enrichment
    const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;
    addMessage({
      role: 'assistant',
      content: `Erstelle ${modeLabel}...`,
      kind: 'status',
      isStreaming: true,
    });

    set({ phase: 'enriching' });

    const response = await ipc.startEnrichment({
      transcript: pendingTranscript!,
      mode,
      language,
      instruction: get().instruction || undefined,
    });

    if (response) {
      set({ activeRunId: response.runId });
    }
  },

  handleUserMessage: async (text) => {
    const { phase, addMessage, selectedMode, pendingTranscript, language, messages, setSettingsOpen, pendingClarification, resolveClarification } = get();

    // Add user message
    addMessage({
      role: 'user',
      content: text,
      kind: 'text',
    });

    // ============================================
    // PRIORITY 1: Check for pending clarification
    // If there's a pending clarification, resolve it directly WITHOUT re-routing through LLM
    // ============================================
    if (pendingClarification) {
      await resolveClarification(text);
      return;
    }

    // Build conversation history for context (last 10 messages)
    const recentHistory = messages.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    if (phase === 'awaiting_context') {
      // User is providing additional context after a clarifying question
      // Combine with existing partial context
      const existingInstruction = get().instruction;
      const combinedContext = existingInstruction
        ? `${existingInstruction}. ${text}`
        : text;

      set({ instruction: combinedContext });

      // Route the combined context to see if we have enough info now
      try {
        const fullTranscript = pendingTranscript
          ? `${pendingTranscript}. ${text}`
          : text;

        const intent = await ipc.routeIntent(fullTranscript, recentHistory);

        if (intent && intent.intent === 'create_artifact' && intent.mode) {
          // Now we have enough info - start enrichment
          const mode = intent.mode as ModeId;
          const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;

          set({ selectedMode: mode, instruction: intent.context || combinedContext });

          addMessage({
            role: 'assistant',
            content: `Erstelle ${modeLabel}...`,
            kind: 'status',
            isStreaming: true,
          });

          set({ phase: 'enriching' });

          ipc.startEnrichment({
            transcript: pendingTranscript || text,
            mode,
            language,
            instruction: intent.context || combinedContext,
          }).then((response) => {
            if (response) {
              set({ activeRunId: response.runId });
            }
          });
        } else if (intent && intent.intent === 'clarify') {
          // Still need more info - use clarification state machine
          const clarificationKind = detectClarificationKind(intent.missingField);
          get().setClarification({
            id: uuidv4(),
            question: intent.question || 'Kannst du mir mehr Details geben?',
            kind: clarificationKind,
            resumePayload: {
              intent: 'create_artifact',
              mode: intent.mode as ModeId | undefined,
              transcript: pendingTranscript || text,
              partialContext: intent.partialContext,
            },
          });
          addMessage({
            role: 'assistant',
            content: intent.question || 'Kannst du mir mehr Details geben?',
            kind: 'question',
          });
          // Stay in awaiting_context phase
        } else {
          // Fallback: use selected mode or meeting
          const mode = selectedMode || 'meeting';
          const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;

          addMessage({
            role: 'assistant',
            content: `Erstelle ${modeLabel}...`,
            kind: 'status',
            isStreaming: true,
          });

          set({ phase: 'enriching' });

          ipc.startEnrichment({
            transcript: pendingTranscript || text,
            mode,
            language,
            instruction: combinedContext,
          }).then((response) => {
            if (response) {
              set({ activeRunId: response.runId });
            }
          });
        }
      } catch (error) {
        console.error('Intent routing error:', error);
        // Fallback: proceed with enrichment using existing mode
        const mode = selectedMode || 'meeting';
        const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;

        addMessage({
          role: 'assistant',
          content: `Erstelle ${modeLabel}...`,
          kind: 'status',
          isStreaming: true,
        });

        set({ phase: 'enriching' });

        ipc.startEnrichment({
          transcript: pendingTranscript || text,
          mode,
          language,
          instruction: combinedContext,
        }).then((response) => {
          if (response) {
            set({ activeRunId: response.runId });
          }
        });
      }
    } else if (phase === 'awaiting_action') {
      // User is responding to mode selection - use intent router with history
      try {
        const intent = await ipc.routeIntent(text, recentHistory);

        if (intent && intent.intent === 'create_artifact' && intent.mode) {
          const mode = intent.mode as ModeId;
          set({ instruction: intent.context || text, selectedMode: mode });

          const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;
          addMessage({
            role: 'assistant',
            content: `Erstelle ${modeLabel}...`,
            kind: 'status',
            isStreaming: true,
          });

          set({ phase: 'enriching' });

          ipc.startEnrichment({
            transcript: pendingTranscript!,
            mode,
            language,
            instruction: intent.context || text,
          }).then((response) => {
            if (response) {
              set({ activeRunId: response.runId });
            }
          });
        } else if (intent && intent.intent === 'clarify') {
          // Need more info - use clarification state machine
          const clarificationKind = detectClarificationKind(intent.missingField);
          get().setClarification({
            id: uuidv4(),
            question: intent.question || 'Kannst du mir mehr Details geben?',
            kind: clarificationKind,
            resumePayload: {
              intent: 'create_artifact',
              mode: intent.mode as ModeId | undefined,
              transcript: pendingTranscript!,
              partialContext: intent.partialContext,
            },
          });
          addMessage({
            role: 'assistant',
            content: intent.question || 'Kannst du mir mehr Details geben?',
            kind: 'question',
          });
          set({ phase: 'awaiting_context' });
        } else if (intent && (intent.intent === 'chat' || intent.intent === 'help' || intent.intent === 'query')) {
          // Conversational response
          addMessage({
            role: 'assistant',
            content: intent.response || 'Wie kann ich dir helfen?',
            kind: 'text',
          });
          set({ phase: 'idle', pendingTranscript: null });
        } else {
          // Fallback: use meeting mode
          set({ instruction: text, selectedMode: 'meeting' });
          addMessage({
            role: 'assistant',
            content: 'Erstelle Meeting-Notiz...',
            kind: 'status',
            isStreaming: true,
          });

          set({ phase: 'enriching' });

          ipc.startEnrichment({
            transcript: pendingTranscript!,
            mode: 'meeting',
            language,
            instruction: text,
          }).then((response) => {
            if (response) {
              set({ activeRunId: response.runId });
            }
          });
        }
      } catch (error) {
        console.error('Intent routing error:', error);
        // Fallback to meeting
        set({ instruction: text, selectedMode: 'meeting', phase: 'enriching' });
        addMessage({
          role: 'assistant',
          content: 'Erstelle Meeting-Notiz...',
          kind: 'status',
          isStreaming: true,
        });

        ipc.startEnrichment({
          transcript: pendingTranscript!,
          mode: 'meeting',
          language,
          instruction: text,
        }).then((response) => {
          if (response) {
            set({ activeRunId: response.runId });
          }
        });
      }
    } else if (phase === 'idle' || phase === 'done' || phase === 'error') {
      // Conversational mode - use intent router
      try {
        const intent = await ipc.routeIntent(text, recentHistory);

        if (!intent) {
          // No API response - fallback
          addMessage({
            role: 'assistant',
            content: 'Hallo! Wie kann ich dir helfen? Halte Space zum Sprechen oder tippe eine Nachricht.',
            kind: 'text',
          });
          set({ phase: 'idle' });
          return;
        }

        // Handle intent
        switch (intent.intent) {
          case 'create_artifact':
            if (intent.mode) {
              const mode = intent.mode as ModeId;
              set({ selectedMode: mode, pendingTranscript: text, instruction: intent.context });

              const modeLabel = MODE_ACTIONS.find((a) => a.id === mode)?.label || mode;
              addMessage({
                role: 'assistant',
                content: `Erstelle ${modeLabel}...`,
                kind: 'status',
                isStreaming: true,
              });

              set({ phase: 'enriching' });

              ipc.startEnrichment({
                transcript: text,
                mode,
                language,
                instruction: intent.context,
              }).then((response) => {
                if (response) {
                  set({ activeRunId: response.runId });
                }
              });
            }
            break;

          case 'clarify':
            // Bot needs more info - use clarification state machine
            {
              const clarificationKind = detectClarificationKind(intent.missingField);
              set({ pendingTranscript: text });
              get().setClarification({
                id: uuidv4(),
                question: intent.question || 'Kannst du mir mehr Details geben?',
                kind: clarificationKind,
                resumePayload: {
                  intent: 'create_artifact',
                  mode: intent.mode as ModeId | undefined,
                  transcript: text,
                  partialContext: intent.partialContext,
                },
              });
              addMessage({
                role: 'assistant',
                content: intent.question || 'Kannst du mir mehr Details geben?',
                kind: 'question',
              });
              set({ phase: 'awaiting_context' });
            }
            break;

          case 'record':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Halte Space gedrückt um aufzunehmen.',
              kind: 'text',
            });
            set({ phase: 'idle' });
            break;

          case 'settings':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich öffne die Einstellungen für dich.',
              kind: 'text',
            });
            setSettingsOpen(true);
            set({ phase: 'idle' });
            break;

          case 'history':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich öffne die History für dich.',
              kind: 'text',
            });
            get().toggleHistory();
            set({ phase: 'idle' });
            break;

          case 'list_projects':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich öffne die Projektübersicht für dich.',
              kind: 'text',
            });
            get().setProjectSwitcherOpen(true);
            set({ phase: 'idle' });
            break;

          case 'create_project':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich öffne den Dialog zum Erstellen eines neuen Projekts.',
              kind: 'text',
            });
            // Open project switcher - user can click "Neues Projekt erstellen"
            get().setProjectSwitcherOpen(true);
            set({ phase: 'idle' });
            break;

          case 'list_contacts':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich öffne deine Kontakte.',
              kind: 'text',
            });
            get().setContactsPanelOpen(true);
            set({ phase: 'idle' });
            break;

          case 'ambiguous_project':
            // User said something like "add to the project" without specifying which one
            // Store the disambiguation context and open project switcher
            {
              const disambiguationAction = intent.action || 'add_artifact';
              get().setPendingDisambiguation({
                id: uuidv4(),
                action: disambiguationAction,
                context: intent.context,
                transcript: text,
                mode: intent.mode as ModeId | undefined,
              });
              addMessage({
                role: 'assistant',
                content: intent.response || 'Welches Projekt meinst du?',
                kind: 'question',
              });
              get().setProjectSwitcherOpen(true);
              set({ phase: 'idle' });
            }
            break;

          case 'help':
            addMessage({
              role: 'assistant',
              content: intent.response || 'Ich helfe dir, Sprache in strukturierte Notizen umzuwandeln. Halte Space gedrückt um zu sprechen.',
              kind: 'text',
            });
            set({ phase: 'idle' });
            break;

          case 'query':
          case 'chat':
          default:
            addMessage({
              role: 'assistant',
              content: intent.response || 'Wie kann ich dir helfen?',
              kind: 'text',
            });
            set({ phase: 'idle' });
            break;
        }
      } catch (error) {
        console.error('Intent routing error:', error);
        // Fallback response without API
        addMessage({
          role: 'assistant',
          content: 'Hallo! Ich bin VoxNote. Halte Space gedrückt um zu sprechen, oder tippe eine Nachricht.',
          kind: 'text',
        });
        set({ phase: 'idle' });
      }
    }
  },

  handleEnrichmentResult: (result) => {
    const { messages, updateMessage, addMessage, selectedMode } = get();

    // Get mode-specific intro
    const mode = selectedMode || 'meeting';
    const intro = MODE_INTROS[mode] || '';
    const contentWithIntro = intro + result.markdown;

    // Extract structured data (e.g., PlanData for plan mode)
    const structuredData = result.json;

    // Find and remove status message
    const statusMsg = messages.find((m) => m.kind === 'status' && m.isStreaming);
    if (statusMsg) {
      updateMessage(statusMsg.id, {
        content: contentWithIntro,
        kind: 'artifact',
        isStreaming: false,
        mode: mode,
        data: structuredData,
      });
    } else {
      addMessage({
        role: 'assistant',
        content: contentWithIntro,
        kind: 'artifact',
        mode: mode,
        data: structuredData,
      });
    }

    // Extract and store pending actions
    const actions = result.actions || [];

    set({
      phase: 'done',
      lastArtifactMarkdown: result.markdown,
      pendingActions: actions,
      activeRunId: null,
      lastErrorCode: null,
    });

    // Refresh history
    get().loadHistoryList();
  },

  handleError: (message, code = 'UNKNOWN') => {
    const { messages, updateMessage, addMessage } = get();

    // Get appropriate actions for this error
    const errorActions = ERROR_ACTIONS[code] || [];

    // Find and update status message
    const statusMsg = messages.find((m) => m.kind === 'status' && m.isStreaming);
    if (statusMsg) {
      updateMessage(statusMsg.id, {
        content: message,
        kind: 'error',
        isStreaming: false,
        errorCode: code,
        suggestedActions: errorActions.length > 0 ? errorActions : undefined,
      });
    } else {
      addMessage({
        role: 'system',
        content: message,
        kind: 'error',
        errorCode: code,
        suggestedActions: errorActions.length > 0 ? errorActions : undefined,
      });
    }

    set({
      phase: 'error',
      errorMessage: message,
      lastErrorCode: code,
      activeRunId: null,
    });
  },

  handleCancelled: () => {
    const { messages, updateMessage, removeMessage } = get();

    // Find and remove or update status message
    const statusMsg = messages.find((m) => m.kind === 'status' && m.isStreaming);
    if (statusMsg) {
      removeMessage(statusMsg.id);
    }

    // Return to appropriate phase
    const { pendingTranscript } = get();
    if (pendingTranscript) {
      set({
        phase: 'awaiting_action',
        activeRunId: null,
      });
    } else {
      set({
        phase: 'idle',
        activeRunId: null,
      });
    }
  },

  retryLastAction: () => {
    const { pendingTranscript, selectedMode, phase, lastErrorCode } = get();

    // If we have a transcript and mode, retry enrichment
    if (pendingTranscript && selectedMode && (phase === 'error' || phase === 'done')) {
      get().startEnrichment();
      return;
    }

    // If we only have transcript, go back to action selection
    if (pendingTranscript) {
      set({ phase: 'awaiting_action' });
      return;
    }

    // Otherwise reset to idle
    set({ phase: 'idle' });
  },

  startEnrichment: async () => {
    const { pendingTranscript, selectedMode, language, instruction, addMessage } = get();
    if (!pendingTranscript || !selectedMode) return;

    // Add status message
    const modeLabel = MODE_ACTIONS.find((a) => a.id === selectedMode)?.label || selectedMode;
    addMessage({
      role: 'assistant',
      content: `Erstelle ${modeLabel}...`,
      kind: 'status',
      isStreaming: true,
    });

    set({ phase: 'enriching' });

    const response = await ipc.startEnrichment({
      transcript: pendingTranscript,
      mode: selectedMode,
      language,
      instruction: instruction || undefined,
    });

    if (response) {
      set({ activeRunId: response.runId });
    }
  },

  // Pipeline events
  subscribeToPipelineEvents: () => {
    return ipc.onPipelineEvent((event: PipelineEvent) => {
      const state = get();

      switch (event.type) {
        case 'status':
          if (event.stage === 'transcribing') {
            // Don't add a message here - page.tsx shows a UI indicator for transcribing
            // This avoids duplicate "Transkribiere..." displays
            set({ phase: 'transcribing' });
          } else if (event.stage === 'enriching') {
            set({ phase: 'enriching' });
          } else if (event.stage === 'cancelled') {
            state.handleCancelled();
          } else if (event.stage === 'done') {
            // Done is handled by result event
          }
          break;

        case 'transcript':
          // Remove status message and handle transcript
          const statusMsg = state.messages.find(
            (m) => m.kind === 'status' && m.isStreaming
          );
          if (statusMsg) {
            state.removeMessage(statusMsg.id);
          }
          state.handleTranscriptReceived(event.transcript);
          break;

        case 'result':
          state.handleEnrichmentResult(event.result);
          break;

        case 'error':
          state.handleError(event.message, event.code);
          break;
      }
    });
  },

  // Actions
  setPendingActions: (actions) => set({ pendingActions: actions }),

  openActionConfirm: (action) =>
    set({ actionConfirmOpen: true, confirmingAction: action }),

  closeActionConfirm: () =>
    set({ actionConfirmOpen: false, confirmingAction: null }),

  executeAction: async (action) => {
    set({ actionExecuting: true });

    try {
      const result = await ipc.executeProposedAction(action);

      if (result.success) {
        // Remove this action from pending
        set((state) => ({
          pendingActions: state.pendingActions.filter((a) => a !== action),
        }));
      }

      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Fehler bei der Ausführung',
      };
    } finally {
      set({ actionExecuting: false, actionConfirmOpen: false, confirmingAction: null });
    }
  },

  // Plan task tracking
  togglePlanTask: async (messageId: string, taskId: string) => {
    const { messages, updateMessage } = get();
    const message = messages.find((m) => m.id === messageId);

    if (!message || message.mode !== 'plan' || !message.data) {
      console.warn('Cannot toggle task: invalid message or not a plan');
      return;
    }

    // Find the task and get current status
    const planData = message.data as { milestones: Array<{ tasks: Array<{ id: string; status: string }> }> };
    let currentStatus = 'todo';

    for (const milestone of planData.milestones) {
      const task = milestone.tasks.find((t) => t.id === taskId);
      if (task) {
        currentStatus = task.status;
        break;
      }
    }

    // Toggle status
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';

    // Update local state optimistically
    const updatedPlanData = JSON.parse(JSON.stringify(planData));
    for (const milestone of updatedPlanData.milestones) {
      const task = milestone.tasks.find((t: { id: string }) => t.id === taskId);
      if (task) {
        task.status = newStatus;
        break;
      }
    }

    updateMessage(messageId, { data: updatedPlanData });

    // Persist to disk (fire and forget - we've already updated UI)
    try {
      // The messageId in our local state is the same as the historyItemId
      // because we use the runId for both
      await ipc.updatePlanTaskStatus(messageId, taskId, newStatus as 'todo' | 'done');
    } catch (error) {
      console.error('Failed to persist task status:', error);
      // Revert optimistic update on failure
      updateMessage(messageId, { data: planData });
    }
  },

  // Reset
  resetConversation: () => {
    set({
      phase: 'idle',
      messages: [],
      draftText: '',
      pendingTranscript: null,
      selectedMode: null,
      instruction: null,
      activeRunId: null,
      lastArtifactMarkdown: null,
      lastErrorCode: null,
      pendingClarification: null, // Clear clarification state
      pendingDisambiguation: null, // Clear disambiguation state (M4)
      pendingActions: [],
      actionConfirmOpen: false,
      confirmingAction: null,
      actionExecuting: false,
      isRecording: false,
      recordingDuration: 0,
      errorMessage: null,
      activeHistoryId: null,
    });
  },
}));
