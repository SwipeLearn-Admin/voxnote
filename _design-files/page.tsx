'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Settings, Mic, Send, X, FolderPlus, Calendar, Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { getModeConfig, MODES, type ModeId } from '@/components/ModeRail';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { BackgroundFallback } from '@/components/BackgroundFallback';
import { useEnergy, useMouse } from '@/hooks/useEnergy';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';
import type { ProposedAction } from '../../electron/shared/actions';

// Minimum recording requirements
const MIN_RECORDING_DURATION_MS = 700;
const MIN_AUDIO_BYTES = 8000;

function chooseRecordingMimeType(): string {
  const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
  }
  return '';
}

// Truncate text to max 3 lines
function truncateText(text: string, maxLines = 3): { text: string; truncated: boolean } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }
  return { text: lines.slice(0, maxLines).join('\n') + '...', truncated: true };
}

export default function Home() {
  const {
    loadSettings,
    loadHistoryList,
    subscribeToPipelineEvents,
    resetConversation,
    phase,
    isRecording,
    recordingDuration,
    settingsOpen,
    setSettingsOpen,
    startRecording,
    setIsRecording,
    setRecordingDuration,
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
    // Actions
    pendingActions,
    actionConfirmOpen,
    confirmingAction,
    actionExecuting,
    openActionConfirm,
    closeActionConfirm,
    executeAction,
  } = useAppStore();

  // Local state
  const [userInput, setUserInput] = useState('');
  const [activeMode, setActiveMode] = useState<ModeId | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Background hooks
  const mouse = useMouse();
  const energy = useEnergy(mediaStream, isRecording);
  const isThinking = phase === 'transcribing' || phase === 'enriching';

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update window size based on state (settings panel is inline, doesn't need larger window)
  useEffect(() => {
    if (showCanvas) {
      ipc.setOverlayLayout('withCanvas');
    } else if (lastArtifactMarkdown || pendingTranscript) {
      ipc.setOverlayLayout('expanded');
    } else {
      ipc.setOverlayLayout('compact');
    }
  }, [showCanvas, lastArtifactMarkdown, pendingTranscript]);

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
    const unsubscribePipeline = subscribeToPipelineEvents();

    let unsubscribeOverlay: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.api) {
      unsubscribeOverlay = window.api.onOverlayToggle(() => {
        resetConversation();
        setActiveMode(null);
        setShowCanvas(false);
      });
    }

    return () => {
      unsubscribePipeline();
      unsubscribeOverlay?.();
    };
  }, [loadSettings, loadHistoryList, subscribeToPipelineEvents, resetConversation]);

  // Start recording
  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream); // Store stream for energy metering

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
        setMediaStream(null); // Clear stream reference

        const recordingDurationMs = Date.now() - recordingStartTimeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

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

      recorder.start(100);
      startRecording();

      recordingIntervalRef.current = setInterval(() => {
        const state = useAppStore.getState();
        if (state.isRecording) {
          setRecordingDuration(state.recordingDuration + 1);
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      handleError('Mikrofon-Zugriff verweigert.');
    }
  }, [isRecording, language, startRecording, setIsRecording, setRecordingDuration, handleError]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Cancel
  const handleCancel = useCallback(async () => {
    if (activeRunId) {
      await ipc.cancelPipeline(activeRunId);
      setPhase('idle');
    }
  }, [activeRunId, setPhase]);

  // Handle mode click - show canvas
  const handleModeClick = useCallback((mode: ModeId) => {
    setActiveMode(mode);
    setShowCanvas(true);
    if (pendingTranscript) {
      handleActionSelected(mode);
    }
  }, [pendingTranscript, handleActionSelected]);

  // Handle input submit
  const handleInputSubmit = useCallback(() => {
    if (!userInput.trim()) return;
    handleUserMessage(userInput.trim());
    setUserInput('');
  }, [userInput, handleUserMessage]);

  // Close canvas
  const handleCloseCanvas = useCallback(() => {
    setShowCanvas(false);
    setActiveMode(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Space - Push to talk
      // Allow recording when: not in input, OR in empty input
      if (e.code === 'Space' && !e.repeat) {
        const inputIsEmpty = !userInput.trim();
        const shouldRecord = !isInputFocused || inputIsEmpty;

        if (shouldRecord) {
          const state = useAppStore.getState();
          const canRecord = ['idle', 'done', 'error', 'awaiting_action'].includes(state.phase);
          if (canRecord && !state.isRecording) {
            e.preventDefault();
            handleStartRecording();
          }
        }
        return;
      }

      // Escape - Close or hide
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showCanvas) {
          handleCloseCanvas();
        } else if (phase === 'transcribing' || phase === 'enriching') {
          handleCancel();
        } else {
          ipc.hideOverlay();
        }
        return;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const state = useAppStore.getState();
        if (state.isRecording) {
          e.preventDefault();
          handleStopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [handleStartRecording, handleStopRecording, handleCancel, handleCloseCanvas, showCanvas, phase, userInput]);

  // API key is now global (env), no per-user warning needed

  // Format duration
  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Truncate transcript for display
  const displayTranscript = pendingTranscript ? truncateText(pendingTranscript, 3) : null;

  return (
    <div className="h-screen w-screen flex items-start justify-center pt-2 overflow-hidden">
      {/* Animated Background */}
      <BackgroundFallback
        energy={energy}
        mouseX={mouse.x}
        mouseY={mouse.y}
        isThinking={isThinking}
      />

      {/* Main Floating Bar Container */}
      <div className="flex gap-2 items-start relative z-10">
        {/* Input Bar */}
        <motion.div
          layout
          className="bg-bg-secondary/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
          style={{ width: showCanvas ? 400 : 460 }}
        >
          {/* API Key is configured globally via environment */}

          {/* Transcript Display (truncated) */}
          <AnimatePresence>
            {displayTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 py-2 border-b border-border/30"
              >
                <p className="text-xs text-muted italic">
                  "{displayTranscript.text}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Response Display */}
          <AnimatePresence>
            {lastArtifactMarkdown && !showCanvas && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-3 py-2 border-b border-border/30 max-h-[200px] overflow-y-auto"
              >
                <div className="text-xs text-text-secondary">
                  <MarkdownRenderer content={lastArtifactMarkdown} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Row */}
          <div className="flex items-center gap-2 p-2">
            {/* Recording indicator / Mic button */}
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.8 }}
                  className="flex items-center gap-2 px-3 py-2 bg-danger/20 rounded-xl"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="w-2.5 h-2.5 rounded-full bg-danger"
                  />
                  <span className="text-xs font-mono text-danger">{formatDuration(recordingDuration)}</span>
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
                  className="p-2.5 rounded-xl bg-surface-glass hover:bg-surface-hover transition-colors"
                  title="Halten zum Sprechen"
                >
                  <Mic className="w-4 h-4 text-muted" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Text Input */}
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userInput.trim()) {
                  e.preventDefault();
                  handleInputSubmit();
                }
              }}
              placeholder={isRecording ? 'Aufnahme läuft...' : 'Nachricht oder Space halten...'}
              disabled={isThinking || isRecording}
              className={clsx(
                'flex-1 px-3 py-2 bg-transparent rounded-lg',
                'text-sm text-text-primary placeholder-muted',
                'focus:outline-none',
                'disabled:opacity-50'
              )}
            />

            {/* Thinking indicator */}
            {isThinking && (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex gap-0.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              </motion.div>
            )}

            {/* Send button */}
            {userInput.trim() && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={handleInputSubmit}
                disabled={isThinking}
                className="p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            )}

            {/* Settings button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <Settings className="w-4 h-4 text-muted" />
            </button>
          </div>

          {/* Keyboard hints */}
          <div className="flex justify-center gap-3 pb-2 text-[9px] text-muted">
            <span><kbd className="px-1 bg-surface-glass rounded">Space</kbd> Sprechen</span>
            <span><kbd className="px-1 bg-surface-glass rounded">Esc</kbd> Schliessen</span>
          </div>
        </motion.div>

        {/* Mode Icons Rail (RIGHT side) */}
        <motion.div
          layout
          className="flex flex-col gap-1 p-1.5 bg-bg-secondary/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-xl overflow-y-auto max-h-[300px]"
        >
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;
            const isSuggested = selectedMode === mode.id;

            return (
              <motion.button
                key={mode.id}
                onClick={() => handleModeClick(mode.id)}
                whileTap={{ scale: 0.9 }}
                className={clsx(
                  'relative w-9 h-9 rounded-lg flex items-center justify-center transition-all',
                  isActive && 'bg-surface-active',
                  !isActive && 'hover:bg-surface-hover'
                )}
                title={mode.label}
              >
                {/* Suggestion pulse */}
                {isSuggested && !isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{ boxShadow: `0 0 12px rgba(${mode.glowColor}, 0.6)` }}
                    animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}

                {/* Active glow */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{ boxShadow: `0 0 15px rgba(${mode.glowColor}, 0.5)` }}
                  />
                )}

                <Icon className={clsx('w-4 h-4 relative z-10', isActive || isSuggested ? mode.color : 'text-muted')} />
              </motion.button>
            );
          })}
        </motion.div>

        {/* Settings Panel - appears inline after mode icons */}
        <AnimatePresence>
          {settingsOpen && !showCanvas && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="bg-bg-secondary/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden self-start"
              style={{ width: 240 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ delay: 0.05, type: "spring", stiffness: 400 }}
                  >
                    <Settings className="w-3.5 h-3.5 text-primary" />
                  </motion.div>
                  <span className="text-xs font-medium text-text-primary">Einstellungen</span>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted" />
                </button>
              </div>

              {/* Content */}
              <motion.div
                className="p-3 space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {/* API Key Info - configured globally */}
                <div className="px-2 py-1.5 bg-surface-glass/50 rounded-lg border border-border/30">
                  <p className="text-[10px] text-muted">OpenAI ist serverseitig konfiguriert.</p>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-[10px] text-muted mb-1">Sprache</label>
                  <select
                    value={settings?.language || 'auto'}
                    onChange={async (e) => {
                      await ipc.setSettings({ language: e.target.value as 'auto' | 'de' | 'en' });
                      loadSettings();
                    }}
                    className="w-full px-2 py-1.5 bg-surface-glass rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary border border-border/30"
                  >
                    <option value="auto">Auto</option>
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Save History Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-muted">History</label>
                  <button
                    onClick={async () => {
                      await ipc.setSettings({ saveHistory: !settings?.saveHistory });
                      loadSettings();
                    }}
                    className={clsx(
                      'w-8 h-4 rounded-full transition-colors relative',
                      settings?.saveHistory ? 'bg-primary' : 'bg-surface-glass border border-border/50'
                    )}
                  >
                    <motion.div
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow"
                      animate={{ left: settings?.saveHistory ? '1rem' : '0.125rem' }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Q-Canvas Popup (appears when mode is clicked) */}
        <AnimatePresence>
          {showCanvas && activeMode && (
            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              className="bg-bg-secondary/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
              style={{ width: 360 }}
            >
              {/* Canvas Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = getModeConfig(activeMode);
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <>
                        <div
                          className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `rgba(${config.glowColor}, 0.15)` }}
                        >
                          <Icon className={clsx('w-3.5 h-3.5', config.color)} />
                        </div>
                        <span className="text-sm font-medium text-text-primary">{config.label}</span>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={handleCloseCanvas}
                  className="p-1 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <X className="w-4 h-4 text-muted" />
                </button>
              </div>

              {/* Canvas Content */}
              <div className="p-3 max-h-[300px] overflow-y-auto">
                {lastArtifactMarkdown ? (
                  <div className="text-sm text-text-secondary">
                    <MarkdownRenderer content={lastArtifactMarkdown} />
                  </div>
                ) : isThinking ? (
                  <div className="flex items-center justify-center py-8">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex gap-1"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    </motion.div>
                  </div>
                ) : (
                  <div className="text-sm text-muted text-center py-8">
                    Sprich oder tippe, um Inhalt zu erstellen
                  </div>
                )}
              </div>

              {/* Proposed Actions */}
              {pendingActions.length > 0 && (
                <div className="px-3 py-2 border-t border-border/30">
                  <p className="text-[10px] text-muted mb-2">Vorgeschlagene Aktionen:</p>
                  <div className="flex flex-wrap gap-2">
                    {pendingActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => openActionConfirm(action)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-surface-glass hover:bg-surface-hover border border-border/50 rounded-lg transition-colors"
                      >
                        {action.type === 'create_project_scaffold' ? (
                          <FolderPlus className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span className="text-text-secondary">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Result Toast */}
              <AnimatePresence>
                {actionResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={clsx(
                      'mx-3 mb-2 px-3 py-2 rounded-lg text-xs',
                      actionResult.success ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                    )}
                  >
                    {actionResult.message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Canvas Actions */}
              {lastArtifactMarkdown && (
                <div className="flex gap-2 p-3 border-t border-border/30">
                  <button
                    onClick={async () => {
                      await ipc.copyToClipboard(lastArtifactMarkdown);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                  >
                    Kopieren
                  </button>
                  <button
                    onClick={async () => {
                      await ipc.copyToClipboard(lastArtifactMarkdown);
                      await ipc.hideOverlay();
                    }}
                    className="flex-1 px-3 py-1.5 text-xs bg-surface-glass text-text-secondary rounded-lg hover:bg-surface-hover transition-colors"
                  >
                    Kopieren & Schliessen
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {actionConfirmOpen && confirmingAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => closeActionConfirm()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-bg-secondary/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl p-4 max-w-sm mx-4"
            >
              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  {confirmingAction.type === 'create_project_scaffold' ? (
                    <FolderPlus className="w-5 h-5 text-primary" />
                  ) : (
                    <Calendar className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Aktion ausführen?</h3>
                  <p className="text-xs text-muted">{confirmingAction.label}</p>
                </div>
              </div>

              {/* Action Details */}
              <div className="bg-surface-glass/50 rounded-lg p-3 mb-4 text-xs text-text-secondary">
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
                  className="flex-1 px-3 py-2 text-xs bg-surface-glass text-text-secondary rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
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
                    // Clear result after 3 seconds
                    setTimeout(() => setActionResult(null), 3000);
                  }}
                  disabled={actionExecuting}
                  className="flex-1 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionExecuting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Ausführen...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Ausführen</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
