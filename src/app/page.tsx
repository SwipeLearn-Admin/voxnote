'use client';

/**
 * VoxNote Main Page
 *
 * Primary UI for the voice-to-structured-notes application.
 * Handles push-to-talk recording, mode selection, chat display,
 * and window layout management (compact/expanded/withCanvas).
 *
 * Key Features:
 * - Push-to-talk via Space key or mic button
 * - 8 processing modes (meeting, tasks, email, ticket, devnote, clean, reminder, plan)
 * - Real-time transcription and AI enrichment
 * - History, projects, and contacts management
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Settings, Mic, Send, X, FolderPlus, Calendar, Check, Loader2, Square } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { MODES, getModeByHotkey } from '@/components/ModeDock';
import { MessageBubble } from '@/components/MessageBubble';
import { BackgroundFallback } from '@/components/BackgroundFallback';
import { AuthButton } from '@/components/AuthButton';
import { HistoryDrawer } from '@/components/HistoryDrawer';
import { ProjectChip } from '@/components/ProjectChip';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { ContactsPanel } from '@/components/ContactsPanel';
import { WindowControls } from '@/components/WindowControls';
import { ProjectsPanel } from '@/components/ProjectsPanel';
import { useEnergy, useMouse } from '@/hooks/useEnergy';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';
import type { ModeId } from '../../electron/shared/types';
import type { ProposedAction } from '../../electron/shared/actions';
import {
  MIN_RECORDING_DURATION_MS,
  MIN_AUDIO_BYTES,
  RECORDING_CHUNK_INTERVAL_MS,
  TEXTAREA_MAX_HEIGHT_PX,
  ACTION_RESULT_TOAST_DURATION_MS,
  SUPPORTED_AUDIO_MIME_TYPES,
} from '@/lib/constants';

function chooseRecordingMimeType(): string {
  for (const mimeType of SUPPORTED_AUDIO_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return '';
}

// Format duration mm:ss
function formatDuration(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function Home() {
  const {
    loadSettings,
    loadHistoryList,
    subscribeToPipelineEvents,
    resetConversation,
    phase,
    isRecording,
    settingsOpen,
    setSettingsOpen,
    startRecording,
    setIsRecording,
    setPhase,
    lastArtifactMarkdown,
    activeRunId,
    language,
    settings,
    handleError,
    pendingTranscript,
    selectedMode,
    handleActionSelected,
    handleUserMessage,
    messages,
    // Actions
    pendingActions,
    actionConfirmOpen,
    confirmingAction,
    actionExecuting,
    openActionConfirm,
    closeActionConfirm,
    executeAction,
    // History
    toggleHistory,
    historyOpen,
    // Projects (M2)
    loadProjects,
    projectSwitcherOpen,
    setProjectSwitcherOpen,
    projectsPanelOpen,
    setProjectsPanelOpen,
    // Contacts (M5)
    contactsPanelOpen,
    setContactsPanelOpen,
  } = useAppStore();

  // Local state
  const [userInput, setUserInput] = useState('');
  const [activeMode, setActiveMode] = useState<ModeId | null>(null);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(true);
  const [localRecordingDuration, setLocalRecordingDuration] = useState(0);

  // Background hooks
  const mouse = useMouse();
  const energy = useEnergy(mediaStream, isRecording);
  const isThinking = phase === 'transcribing' || phase === 'enriching';

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const hasExpandedRef = useRef<boolean>(false);

  // Refs for stable keyboard handling (prevent listener re-registration)
  const userInputRef = useRef(userInput);
  const settingsOpenRef = useRef(settingsOpen);
  const phaseRef = useRef(phase);
  const projectsPanelOpenRef = useRef(projectsPanelOpen);

  // Keep refs in sync with state
  useEffect(() => { userInputRef.current = userInput; }, [userInput]);
  useEffect(() => { settingsOpenRef.current = settingsOpen; }, [settingsOpen]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { projectsPanelOpenRef.current = projectsPanelOpen; }, [projectsPanelOpen]);

  // Expand window when user starts interaction
  const expandWindow = useCallback(() => {
    if (!hasExpandedRef.current) {
      hasExpandedRef.current = true;
      setIsCompactMode(false);
      ipc.setOverlayLayout('expanded');
    }
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isRecording]);

  // Recording timer - runs when isRecording is true
  useEffect(() => {
    if (!isRecording) {
      setLocalRecordingDuration(0);
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setLocalRecordingDuration(elapsed);
    }, 100);

    return () => clearInterval(timer);
  }, [isRecording]);

  // Sync layout with message state: compact when empty, expanded when has content
  // Skip if history or projects panel is open (uses withCanvas layout)
  useEffect(() => {
    if (historyOpen || projectsPanelOpen) {
      // Side panel is managing the layout (withCanvas)
      setIsCompactMode(false);
      hasExpandedRef.current = true;
      ipc.setOverlayLayout('withCanvas');
      return;
    }

    if (messages.length > 0) {
      // Has content → expanded
      if (!hasExpandedRef.current) {
        hasExpandedRef.current = true;
        setIsCompactMode(false);
        ipc.setOverlayLayout('expanded');
      }
    } else if (!isRecording) {
      // Empty and not recording → compact
      hasExpandedRef.current = false;
      setIsCompactMode(true);
      ipc.setOverlayLayout('compact');
    }
  }, [messages.length, isRecording, historyOpen, projectsPanelOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, TEXTAREA_MAX_HEIGHT_PX) + 'px';
    }
  }, [userInput]);

  // Update active mode from store
  useEffect(() => {
    if (selectedMode) {
      setActiveMode(selectedMode as ModeId);
    }
  }, [selectedMode]);

  // Initialize app
  useEffect(() => {
    loadSettings();
    loadHistoryList();
    loadProjects();
    const unsubscribePipeline = subscribeToPipelineEvents();

    // Start in compact mode - expansion happens on interaction
    ipc.setOverlayLayout('compact');
    hasExpandedRef.current = false;

    let unsubscribeOverlay: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.api) {
      unsubscribeOverlay = window.api.onOverlayToggle(() => {
        // Only reset if chat is empty - keep content visible if there's something
        const currentMessages = useAppStore.getState().messages;
        if (currentMessages.length === 0) {
          resetConversation();
          setActiveMode(null);
          hasExpandedRef.current = false;
          setIsCompactMode(true);
          ipc.setOverlayLayout('compact');
        }
        // Focus the input for quick interaction
        textareaRef.current?.focus();
      });
    }

    return () => {
      unsubscribePipeline();
      unsubscribeOverlay?.();
    };
  }, [loadSettings, loadHistoryList, loadProjects, subscribeToPipelineEvents, resetConversation]);

  /**
   * Initiates voice recording via MediaRecorder API.
   * Sets up audio stream, configures recorder with best available codec,
   * and handles the recording lifecycle including validation and transcription.
   */
  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;

    // Window stays compact during recording - expands when transcript arrives

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);

      const mimeType = chooseRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setMediaStream(null);

        const recordingDurationMs = Date.now() - recordingStartTimeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        // Timer cleanup is handled by useEffect
        setIsRecording(false);

        if (recordingDurationMs < MIN_RECORDING_DURATION_MS || audioBlob.size < MIN_AUDIO_BYTES) {
          handleError('Aufnahme zu kurz – bitte 1–2 Sekunden sprechen.');
          return;
        }

        const audioBuffer = await audioBlob.arrayBuffer();
        const response = await ipc.startTranscription({
          audio: audioBuffer,
          mimeType: audioBlob.type,
          language: language,
        });

        if (response) {
          useAppStore.getState().setActiveRunId(response.runId);
        }
      };

      recorder.start(RECORDING_CHUNK_INTERVAL_MS);
      startRecording();
      // Timer is now managed by useEffect based on isRecording state
    } catch (error) {
      console.error('Failed to start recording:', error);
      handleError('Mikrofon-Zugriff verweigert.');
    }
  }, [isRecording, language, startRecording, setIsRecording, handleError]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Cancel pipeline
  const handleCancel = useCallback(async () => {
    if (activeRunId) {
      await ipc.cancelPipeline(activeRunId);
      setPhase('idle');
    }
  }, [activeRunId, setPhase]);

  // Handle mode click
  const handleModeClick = useCallback((mode: ModeId) => {
    setActiveMode(mode);
    const store = useAppStore.getState();

    // If we have a pending transcript, process it with this mode
    if (store.pendingTranscript && ['awaiting_action', 'idle', 'done'].includes(store.phase)) {
      handleActionSelected(mode);
    } else {
      // Otherwise set the mode for next recording WITH feedback message
      store.activateModeWithFeedback(mode);
      // Expand window to show the feedback
      expandWindow();
    }
  }, [handleActionSelected, expandWindow]);

  // Handle input submit
  const handleInputSubmit = useCallback(() => {
    if (!userInput.trim()) return;
    // Expand window when user sends a message
    expandWindow();
    handleUserMessage(userInput.trim());
    setUserInput('');
    // Also update ref immediately for keyboard handler
    userInputRef.current = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Blur textarea so Space works immediately after sending
      textareaRef.current.blur();
    }
  }, [userInput, handleUserMessage, expandWindow]);

  // Stable refs for keyboard handler functions
  const handleStartRecordingRef = useRef(handleStartRecording);
  const handleStopRecordingRef = useRef(handleStopRecording);
  const handleCancelRef = useRef(handleCancel);
  const toggleHistoryRef = useRef(toggleHistory);
  const handleModeClickRef = useRef(handleModeClick);

  // Keep function refs in sync
  useEffect(() => { handleStartRecordingRef.current = handleStartRecording; }, [handleStartRecording]);
  useEffect(() => { handleStopRecordingRef.current = handleStopRecording; }, [handleStopRecording]);
  useEffect(() => { handleCancelRef.current = handleCancel; }, [handleCancel]);
  useEffect(() => { toggleHistoryRef.current = toggleHistory; }, [toggleHistory]);
  useEffect(() => { handleModeClickRef.current = handleModeClick; }, [handleModeClick]);

  /**
   * Global keyboard shortcut handler.
   * Uses capture phase to intercept events before other handlers.
   * Manages: Space (PTT), Escape (close/cancel), 1-8 (modes), H (history), Cmd+P (projects)
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Space - Push to talk (only when input is empty or not focused)
      if (e.code === 'Space' && !e.repeat) {
        const inputIsEmpty = !userInputRef.current.trim();
        const shouldRecord = !isInputFocused || inputIsEmpty;
        const state = useAppStore.getState();

        // Debug logging
        console.log('[PTT] Space pressed:', {
          isInputFocused,
          inputIsEmpty,
          shouldRecord,
          phase: state.phase,
          isRecording: state.isRecording,
        });

        if (shouldRecord) {
          const canRecord = ['idle', 'done', 'error', 'awaiting_action'].includes(state.phase);
          if (canRecord && !state.isRecording) {
            e.preventDefault();
            handleStartRecordingRef.current();
          } else {
            console.log('[PTT] Cannot record:', { canRecord, isRecording: state.isRecording });
          }
        }
        return;
      }

      // Escape - Close or cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        if (settingsOpenRef.current) {
          setSettingsOpen(false);
        } else if (phaseRef.current === 'transcribing' || phaseRef.current === 'enriching') {
          handleCancelRef.current();
        } else {
          ipc.hideOverlay();
        }
        return;
      }

      // Number keys 1-8 - Mode selection
      // Works when: input is empty OR not focused, and we have a pending transcript
      if (e.key >= '1' && e.key <= '8') {
        const inputIsEmpty = !userInputRef.current.trim();
        const canSelectMode = !isInputFocused || inputIsEmpty;

        if (canSelectMode) {
          const mode = getModeByHotkey(e.key);
          if (mode) {
            const state = useAppStore.getState();
            // Allow mode selection when awaiting_action OR idle/done with pending transcript
            if (state.pendingTranscript && ['awaiting_action', 'idle', 'done'].includes(state.phase)) {
              e.preventDefault();
              handleModeClickRef.current(mode.id);
              return;
            }
            // Also allow setting mode for next recording when idle
            if (state.phase === 'idle' || state.phase === 'done') {
              e.preventDefault();
              handleModeClickRef.current(mode.id);
              return;
            }
          }
        }
      }

      // H key - Toggle history
      if ((e.key === 'h' || e.key === 'H') && !isInputFocused) {
        e.preventDefault();
        toggleHistoryRef.current();
        return;
      }

      // Cmd/Ctrl+P - Toggle projects panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setProjectsPanelOpen(!projectsPanelOpenRef.current);
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const state = useAppStore.getState();
        if (state.isRecording) {
          e.preventDefault();
          handleStopRecordingRef.current();
        }
      }
    };

    // Register once with capture to ensure we get events first
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [setSettingsOpen, setProjectsPanelOpen]); // Minimal deps - only setters which are stable

  // Check if chat is empty
  const isEmpty = messages.length === 0 && !isRecording;

  return (
    <div className="relative h-screen w-screen overflow-hidden flex">
      {/* Animated Background */}
      <BackgroundFallback
        energy={energy}
        mouseX={mouse.x}
        mouseY={mouse.y}
        isThinking={isThinking}
      />

      {/* Main Content Container - uses flex-1 to fill remaining space */}
      <div className={clsx(
        "relative z-10 h-full flex-1 flex flex-col min-w-0 transition-all duration-300",
        isCompactMode && "justify-center"
      )}>
        {/* Window Controls - Titlebar with drag region */}
        <WindowControls className="shrink-0 px-2 pt-2" />

        {/* Chat Area - scrollable, fills remaining height (hidden in compact mode) */}
        <div
          ref={chatScrollRef}
          className={clsx(
            "flex-1 overflow-y-auto px-4 py-4 transition-opacity duration-200",
            isCompactMode && "hidden"
          )}
        >
          {/* Empty state */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center h-full text-center"
              >
                <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
                  <Mic className="w-7 h-7 text-white/40" />
                </div>
                <p className="text-white/60 text-sm mb-1">
                  Halte <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80">Space</kbd> zum Sprechen
                </p>
                <p className="text-white/40 text-xs">
                  oder tippe unten eine Nachricht
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recording indicator in chat */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex justify-center my-4"
              >
                <div className="flex items-center gap-3 px-5 py-3 glass rounded-2xl border border-red-500/30">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-red-500"
                  />
                  <span className="text-red-400 font-medium">Aufnahme läuft</span>
                  <span className="text-red-400 font-mono text-lg tabular-nums">
                    {formatDuration(localRecordingDuration)}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
              >
                <MessageBubble
                  message={message}
                  onActionSelect={(actionId) => handleActionSelected(actionId as ModeId)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading/Thinking indicator in chat */}
          <AnimatePresence>
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex justify-start my-2"
              >
                <div className="flex items-center gap-2 px-4 py-3 glass rounded-2xl">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-4 h-4 text-white/60" />
                  </motion.div>
                  <span className="text-white/60 text-sm">
                    {phase === 'transcribing' ? 'Transkribiere...' : 'Verarbeite...'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Area - shrink-0 */}
        <div className={clsx(
          "shrink-0 px-4",
          isCompactMode ? "py-4" : "pb-3"
        )}>
          {/* Mode Selection Prompt - shown when awaiting_action (hidden in compact) */}
          <AnimatePresence>
            {!isCompactMode && phase === 'awaiting_action' && pendingTranscript && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="mb-2 text-center"
              >
                <p className="text-xs text-purple-400/80">
                  Drücke <kbd className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 mx-0.5">1</kbd>-<kbd className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 mx-0.5">8</kbd> für einen Modus
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Proposed Actions (hidden in compact) */}
          {!isCompactMode && pendingActions.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {pendingActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => openActionConfirm(action)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs glass hover:bg-white/10 rounded-xl transition-colors"
                  >
                    {action.type === 'create_project_scaffold' ? (
                      <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span className="text-white/80">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Result Toast (hidden in compact) */}
          <AnimatePresence>
            {!isCompactMode && actionResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={clsx(
                  'mb-3 px-4 py-2 rounded-xl text-sm text-center',
                  actionResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}
              >
                {actionResult.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="glass rounded-2xl p-2">
            <div className="flex items-center gap-2">
              {/* Recording indicator / Mic button */}
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div
                    key="recording"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.8 }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/20 rounded-xl shrink-0"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2.5 h-2.5 rounded-full bg-red-500"
                    />
                    <span className="text-xs font-mono text-red-400">{formatDuration(localRecordingDuration)}</span>
                  </motion.div>
                ) : (
                  <motion.button
                    key="mic"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.8 }}
                    onMouseDown={handleStartRecording}
                    onMouseUp={handleStopRecording}
                    onMouseLeave={handleStopRecording}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors shrink-0"
                    title="Halten zum Sprechen"
                  >
                    <Mic className="w-5 h-5 text-white/50" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Textarea Input */}
              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && userInput.trim()) {
                    e.preventDefault();
                    handleInputSubmit();
                  }
                }}
                placeholder={isRecording ? 'Aufnahme läuft...' : 'Nachricht eingeben...'}
                disabled={isThinking || isRecording}
                rows={1}
                className={clsx(
                  'flex-1 px-3 py-2 bg-transparent rounded-lg resize-none',
                  'text-sm text-white placeholder-white/30',
                  'focus:outline-none',
                  'disabled:opacity-50'
                )}
                style={{ maxHeight: `${TEXTAREA_MAX_HEIGHT_PX}px` }}
              />

              {/* Thinking indicator */}
              {isThinking && (
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="flex gap-0.5 shrink-0 px-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                </motion.div>
              )}

              {/* Send button */}
              {userInput.trim() && !isThinking && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={handleInputSubmit}
                  className="p-2.5 rounded-xl bg-purple-500 text-white hover:bg-purple-400 transition-colors shrink-0"
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              )}

              {/* Project chip (hidden in compact) */}
              {!isCompactMode && <ProjectChip />}

              {/* Auth button (hidden in compact) */}
              {!isCompactMode && <AuthButton />}

              {/* Settings button (hidden in compact) */}
              {!isCompactMode && (
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="p-2.5 rounded-xl hover:bg-white/10 transition-colors shrink-0"
                >
                  <Settings className="w-5 h-5 text-white/40" />
                </button>
              )}
            </div>
          </div>

          {/* Keyboard hints - Two rows (hidden in compact mode) */}
          {!isCompactMode && (
            <div className="mt-2 space-y-1.5">
              {/* Mode hotkeys row */}
              <div className="flex justify-center gap-1">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => handleModeClick(mode.id)}
                      className={clsx(
                        "flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-colors group",
                        activeMode === mode.id
                          ? "bg-white/20 ring-1 ring-white/30"
                          : "hover:bg-white/10"
                      )}
                      title={mode.label}
                    >
                      <kbd className={clsx(
                        "px-1 py-0.5 rounded text-[10px] font-medium transition-colors",
                        activeMode === mode.id
                          ? "bg-white/30 text-white/90"
                          : "bg-white/10 text-white/50 group-hover:bg-white/20 group-hover:text-white/80"
                      )}>
                        {mode.hotkey}
                      </kbd>
                      <Icon className={clsx(
                        'w-3 h-3 transition-opacity',
                        mode.color,
                        activeMode === mode.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'
                      )} />
                    </button>
                  );
                })}
              </div>
              {/* General shortcuts row */}
              <div className="flex justify-center gap-3 text-[10px] text-white/30">
                <span><kbd className="px-1 py-0.5 rounded bg-white/10">Space</kbd> Sprechen</span>
                <span><kbd className="px-1 py-0.5 rounded bg-white/10">Enter</kbd> Senden</span>
                <span><kbd className="px-1 py-0.5 rounded bg-white/10">H</kbd> History</span>
                <span><kbd className="px-1 py-0.5 rounded bg-white/10">⌘P</kbd> Projekte</span>
                <span><kbd className="px-1 py-0.5 rounded bg-white/10">Esc</kbd> Schließen</span>
              </div>
            </div>
          )}

          {/* Compact mode hint */}
          {isCompactMode && (
            <div className="mt-1.5 text-center text-[10px] text-white/30">
              <kbd className="px-1 py-0.5 rounded bg-white/10">Space</kbd> zum Sprechen
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel Overlay */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl border border-white/10 shadow-2xl p-4 w-72"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">Einstellungen</span>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* API Key Info */}
                <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-xs text-white/50">OpenAI ist serverseitig konfiguriert.</p>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">Sprache</label>
                  <select
                    value={settings?.language || 'auto'}
                    onChange={async (e) => {
                      await ipc.setSettings({ language: e.target.value as 'auto' | 'de' | 'en' });
                      loadSettings();
                    }}
                    className="w-full px-3 py-2 bg-white/5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500 border border-white/10"
                  >
                    <option value="auto">Auto</option>
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Save History Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/50">History speichern</label>
                  <button
                    onClick={async () => {
                      await ipc.setSettings({ saveHistory: !settings?.saveHistory });
                      loadSettings();
                    }}
                    className={clsx(
                      'w-10 h-5 rounded-full transition-colors relative',
                      settings?.saveHistory ? 'bg-purple-500' : 'bg-white/10'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                      animate={{ left: settings?.saveHistory ? '1.25rem' : '0.125rem' }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {actionConfirmOpen && confirmingAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => closeActionConfirm()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl border border-white/10 shadow-2xl p-4 max-w-sm mx-4"
            >
              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  {confirmingAction.type === 'create_project_scaffold' ? (
                    <FolderPlus className="w-5 h-5 text-purple-400" />
                  ) : (
                    <Calendar className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Aktion ausführen?</h3>
                  <p className="text-xs text-white/50">{confirmingAction.label}</p>
                </div>
              </div>

              {/* Action Details */}
              <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs text-white/70">
                {confirmingAction.type === 'create_project_scaffold' && 'params' in confirmingAction && (
                  <>
                    <p><strong>Projekt:</strong> {(confirmingAction.params as { projectName: string }).projectName}</p>
                    <p className="mt-1"><strong>Beschreibung:</strong> {(confirmingAction.params as { summary: string }).summary}</p>
                  </>
                )}
                {confirmingAction.type === 'create_calendar_event_ics' && 'params' in confirmingAction && (
                  <>
                    <p><strong>Termin:</strong> {(confirmingAction.params as { title: string }).title}</p>
                    <p className="mt-1"><strong>Zeit:</strong> {new Date((confirmingAction.params as { startISO: string }).startISO).toLocaleString()}</p>
                  </>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => closeActionConfirm()}
                  disabled={actionExecuting}
                  className="flex-1 px-3 py-2 text-sm bg-white/5 text-white/70 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    const result = await executeAction(confirmingAction);
                    setActionResult({
                      success: result.success,
                      message: result.message || (result.success ? 'Erfolgreich ausgeführt' : 'Fehler'),
                    });
                    setTimeout(() => setActionResult(null), ACTION_RESULT_TOAST_DURATION_MS);
                  }}
                  disabled={actionExecuting}
                  className="flex-1 px-3 py-2 text-sm bg-purple-500 text-white rounded-xl hover:bg-purple-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Ausführen...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Ausführen</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Switcher Modal */}
      <ProjectSwitcher />

      {/* Contacts Panel (M5) */}
      <ContactsPanel
        open={contactsPanelOpen}
        onClose={() => setContactsPanelOpen(false)}
      />

      {/* Projects Panel */}
      <ProjectsPanel />

      {/* History Drawer */}
      <HistoryDrawer />
    </div>
  );
}
