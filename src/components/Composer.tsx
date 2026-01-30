'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, Square, Copy, Check, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useCopy } from '@/lib/hooks/useCopy';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';

export function Composer() {
  const {
    draftText,
    setDraftText,
    phase,
    isRecording,
    lastArtifactMarkdown,
    handleUserMessage,
    activeRunId,
  } = useAppStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const { copy, copied } = useCopy();

  // Focus input when phase changes to awaiting
  useEffect(() => {
    if (phase === 'awaiting_action' || phase === 'awaiting_context') {
      inputRef.current?.focus();
    }
  }, [phase]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) return;

    handleUserMessage(draftText.trim());
    setDraftText('');
  };

  const handleCopy = () => {
    if (lastArtifactMarkdown) {
      copy(lastArtifactMarkdown);
    }
  };

  const handleCopyAndClose = async () => {
    if (lastArtifactMarkdown) {
      await ipc.copyToClipboard(lastArtifactMarkdown);
      await ipc.hideOverlay();
    }
  };

  const handleCancel = async () => {
    if (activeRunId) {
      await ipc.cancelPipeline(activeRunId);
    }
  };

  const isProcessing = phase === 'transcribing' || phase === 'enriching';
  const canSend = draftText.trim().length > 0 && !isRecording && !isProcessing;
  const hasDone = phase === 'done' && lastArtifactMarkdown;

  return (
    <div className="shrink-0 border-t border-border bg-bg-secondary/50 backdrop-blur-sm px-4 py-3">
      {/* Quick actions when done */}
      <AnimatePresence>
        {hasDone && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 mb-3"
          >
            <button
              onClick={handleCopy}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-xl transition-all',
                copied
                  ? 'bg-success hover:bg-success/90'
                  : 'bg-primary hover:bg-primary-hover hover:shadow-glow-primary'
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Kopiert' : 'Kopieren'}
              {!copied && <kbd className="ml-1">Enter</kbd>}
            </button>
            <button
              onClick={handleCopyAndClose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm glass glass-hover text-text-primary rounded-xl transition-all"
            >
              Kopieren + Schließen
              <kbd className="ml-1">⌘↵</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel button when processing */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 mb-3"
          >
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-danger/15 hover:bg-danger/25 text-danger rounded-xl transition-colors border border-danger/20"
            >
              <X className="w-4 h-4" />
              Abbrechen
              <kbd className="ml-1">Esc</kbd>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={
              isRecording
                ? 'Aufnahme läuft...'
                : phase === 'awaiting_context'
                ? 'Kontext eingeben...'
                : 'Nachricht oder Anweisung...'
            }
            disabled={isRecording || isProcessing}
            className={clsx(
              'w-full px-4 py-2.5 glass rounded-xl',
              'text-sm text-text-primary placeholder-muted',
              'focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-150'
            )}
          />
        </div>

        {/* Mic indicator */}
        <motion.div
          animate={isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={isRecording ? { duration: 1, repeat: Infinity } : {}}
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'transition-all duration-150',
            {
              'bg-danger text-white shadow-glow-danger': isRecording,
              'glass text-muted': !isRecording,
            }
          )}
          title="Space halten zum Sprechen"
        >
          {isRecording ? (
            <Square className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </motion.div>

        {/* Send button */}
        <motion.button
          type="submit"
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.02 } : {}}
          whileTap={canSend ? { scale: 0.98 } : {}}
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'transition-all duration-150',
            {
              'bg-primary text-white hover:bg-primary-hover hover:shadow-glow-primary': canSend,
              'glass text-muted cursor-not-allowed': !canSend,
            }
          )}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </form>

      {/* Hint */}
      <div className="flex items-center justify-center gap-4 mt-2.5 text-xs text-muted">
        <span className="flex items-center gap-1">
          <kbd>Space</kbd> Sprechen
        </span>
        <span className="flex items-center gap-1">
          <kbd>H</kbd> History
        </span>
        <span className="flex items-center gap-1">
          <kbd>Esc</kbd> Schließen
        </span>
      </div>
    </div>
  );
}
