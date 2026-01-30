'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';
import { AnimatedBorderBox, type AnimationState } from './AnimatedBorderBox';
import { MarkdownRenderer } from './MarkdownRenderer';
import clsx from 'clsx';

interface LLMResponseFieldProps {
  /** The response text from the LLM */
  response: string | null;
  /** Suggested mode for saving (highlighted) */
  suggestedMode?: string | null;
  /** Animation state for the border */
  animationState: AnimationState;
  /** Whether the LLM is currently thinking */
  isThinking?: boolean;
  className?: string;
}

/**
 * LLMResponseField - Middle display area for LLM responses
 *
 * Shows:
 * - Animated border when processing
 * - Response text with markdown rendering
 * - Suggested mode indicator
 * - Thinking animation when waiting
 */
export function LLMResponseField({
  response,
  suggestedMode,
  animationState,
  isThinking = false,
  className
}: LLMResponseFieldProps) {
  const showContent = response || isThinking;

  return (
    <AnimatePresence mode="wait">
      {showContent && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={clsx('w-full max-w-[440px] mx-auto', className)}
        >
          <AnimatedBorderBox
            state={animationState}
            speedMultiplier={1.25} // 25% faster for LLM processing
          >
            <div className="p-4 min-h-[80px]">
              {/* Header with brain icon */}
              <div className="flex items-center gap-2 mb-3">
                <div className={clsx(
                  'w-6 h-6 rounded-lg flex items-center justify-center',
                  'bg-primary/15'
                )}>
                  <Brain className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted">
                  {isThinking ? 'Denke nach...' : 'Antwort'}
                </span>

                {/* Suggested mode badge */}
                {suggestedMode && !isThinking && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-success/15 rounded-full"
                  >
                    <Sparkles className="w-3 h-3 text-success" />
                    <span className="text-[10px] text-success font-medium">
                      {suggestedMode}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Response content */}
              {isThinking ? (
                <ThinkingAnimation />
              ) : response ? (
                <div className="text-sm text-text-secondary leading-relaxed">
                  <MarkdownRenderer content={response} />
                </div>
              ) : null}

              {/* Confirm/Deny hint */}
              {response && !isThinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-4 text-[10px] text-muted"
                >
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-success/20 text-success rounded">Y</kbd>
                    Bestaetigen
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-danger/20 text-danger rounded">N</kbd>
                    Korrigieren
                  </span>
                </motion.div>
              )}
            </div>
          </AnimatedBorderBox>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ThinkingAnimation() {
  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="flex gap-1"
        initial="start"
        animate="end"
        variants={{
          start: {},
          end: {},
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60"
            animate={{
              y: [0, -6, 0],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
      <span className="text-xs text-muted">Einen Moment...</span>
    </div>
  );
}
