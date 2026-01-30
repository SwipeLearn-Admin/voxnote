'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { MessageBubble } from './MessageBubble';
import { formatDuration } from '@/lib/markdown';
import clsx from 'clsx';
import type { ModeId } from '../../electron/shared/types';

export function ChatThread() {
  const {
    messages,
    phase,
    isRecording,
    recordingDuration,
    handleActionSelected,
  } = useAppStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isRecording]);

  const handleActionSelect = (actionId: string) => {
    handleActionSelected(actionId as ModeId);
  };

  const isEmpty = messages.length === 0 && !isRecording;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-4"
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
            <div
              className={clsx(
                'w-20 h-20 rounded-full flex items-center justify-center mb-4',
                'glass border-border-default'
              )}
            >
              <Mic className="w-8 h-8 text-muted" />
            </div>
            <p className="text-text-secondary text-sm mb-1">
              Halte <kbd>Space</kbd> zum Sprechen
            </p>
            <p className="text-muted text-xs">
              oder tippe unten eine Nachricht
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex justify-center my-4"
          >
            <div className="flex items-center gap-3 px-5 py-3 glass-strong rounded-2xl animate-recording-glow border-danger/30">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-danger"
              />
              <span className="text-danger font-medium">
                Aufnahme läuft
              </span>
              <span className="text-danger font-mono text-lg tabular-nums">
                {formatDuration(recordingDuration)}
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
              onActionSelect={handleActionSelect}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
