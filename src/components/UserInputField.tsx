'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Send } from 'lucide-react';
import { AnimatedBorderBox, type AnimationState } from './AnimatedBorderBox';
import clsx from 'clsx';

interface UserInputFieldProps {
  /** Current input text */
  value: string;
  /** Input change handler */
  onChange: (value: string) => void;
  /** Submit handler (Enter key or send button) */
  onSubmit: () => void;
  /** Animation state for the border */
  animationState: AnimationState;
  /** Whether currently recording */
  isRecording?: boolean;
  /** Recording duration in seconds */
  recordingDuration?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  className?: string;
}

/**
 * UserInputField - Bottom input area with animated border
 *
 * Features:
 * - Text input with send button
 * - Animated rainbow border when recording
 * - Recording indicator with duration
 * - Keyboard shortcut hints
 */
export const UserInputField = forwardRef<HTMLInputElement, UserInputFieldProps>(
  function UserInputField(
    {
      value,
      onChange,
      onSubmit,
      animationState,
      isRecording = false,
      recordingDuration = 0,
      disabled = false,
      placeholder = 'Nachricht oder Anweisung...',
      className,
    },
    ref
  ) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
        e.preventDefault();
        onSubmit();
      }
    };

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <div className={clsx('w-full max-w-[440px] mx-auto', className)}>
        <AnimatedBorderBox state={animationState}>
          <div className="relative">
            {/* Recording overlay */}
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-bg-secondary/95 rounded-xl flex items-center justify-center gap-3 z-10"
              >
                {/* Pulsing mic icon */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center"
                >
                  <Mic className="w-5 h-5 text-danger" />
                </motion.div>

                {/* Duration */}
                <div className="text-center">
                  <p className="text-lg font-mono text-text-primary">
                    {formatDuration(recordingDuration)}
                  </p>
                  <p className="text-xs text-muted">Space loslassen zum Beenden</p>
                </div>

                {/* Waveform visualization */}
                <div className="flex items-center gap-0.5 h-8">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-danger rounded-full"
                      animate={{
                        height: ['12px', '24px', '12px'],
                      }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-2 p-2">
              {/* Text input */}
              <input
                ref={ref}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled || isRecording}
                className={clsx(
                  'flex-1 px-3 py-2.5 bg-transparent rounded-lg',
                  'text-sm text-text-primary placeholder-muted',
                  'focus:outline-none',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-all duration-150'
                )}
              />

              {/* Mic indicator (when not recording, shows as hint) */}
              <div
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  'glass text-muted',
                  'transition-all'
                )}
                title="Space halten zum Sprechen"
              >
                <Mic className="w-4 h-4" />
              </div>

              {/* Send button */}
              <button
                onClick={onSubmit}
                disabled={disabled || isRecording || !value.trim()}
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  'transition-all duration-150',
                  value.trim()
                    ? 'bg-primary text-white hover:bg-primary-hover'
                    : 'glass text-muted cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Keyboard shortcuts */}
            <div className="flex items-center justify-center gap-4 pb-2 text-[10px] text-muted">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-surface-glass rounded">Space</kbd>
                Sprechen
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-surface-glass rounded">Y</kbd>
                /
                <kbd className="px-1 py-0.5 bg-surface-glass rounded">N</kbd>
                Antworten
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-surface-glass rounded">Esc</kbd>
                Schliessen
              </span>
            </div>
          </div>
        </AnimatedBorderBox>
      </div>
    );
  }
);
