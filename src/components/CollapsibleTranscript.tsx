'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Mic } from 'lucide-react';
import clsx from 'clsx';

interface CollapsibleTranscriptProps {
  /** The transcript text */
  transcript: string;
  /** Whether collapsed by default */
  defaultCollapsed?: boolean;
  /** Timestamp */
  timestamp?: Date;
  className?: string;
}

/**
 * CollapsibleTranscript - Minimized view of user's voice transcript
 *
 * Features:
 * - Collapsed by default (just shows icon + first few words)
 * - Expandable to see full transcript
 * - Mic icon indicates voice input
 * - Compact appearance to keep focus on LLM output
 */
export function CollapsibleTranscript({
  transcript,
  defaultCollapsed = true,
  timestamp,
  className,
}: CollapsibleTranscriptProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Get preview (first 40 chars)
  const getPreview = () => {
    if (transcript.length <= 40) return transcript;
    return transcript.substring(0, 40) + '...';
  };

  return (
    <div className={clsx('flex justify-end', className)}>
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={clsx(
          'group flex items-start gap-2 max-w-[80%] text-left',
          'px-3 py-2 rounded-xl',
          'bg-primary/10 hover:bg-primary/15',
          'border border-primary/20',
          'transition-all duration-150'
        )}
        whileTap={{ scale: 0.98 }}
      >
        {/* Mic icon */}
        <div className="shrink-0 mt-0.5">
          <Mic className="w-3.5 h-3.5 text-primary/60" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {isCollapsed ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                <span className="text-xs text-primary/80 truncate">
                  {getPreview()}
                </span>
                <ChevronRight className="w-3 h-3 text-primary/40 shrink-0" />
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-primary/50 uppercase tracking-wide">
                    Transkript
                  </span>
                  {timestamp && (
                    <span className="text-[10px] text-primary/40">
                      {timestamp.toLocaleTimeString('de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 text-primary/40 ml-auto" />
                </div>
                <p className="text-xs text-primary/80 whitespace-pre-wrap">
                  {transcript}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    </div>
  );
}
