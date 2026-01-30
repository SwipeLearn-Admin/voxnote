'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  CheckSquare,
  Mail,
  Ticket,
  Code,
  Sparkles,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

export type ModeId = 'meeting' | 'tasks' | 'email' | 'ticket' | 'devnote' | 'clean' | 'reminder';

interface ModeConfig {
  id: ModeId;
  label: string;
  icon: LucideIcon;
  color: string; // Tailwind color class
  glowColor: string; // RGB for glow effect
}

const MODES: ModeConfig[] = [
  { id: 'meeting', label: 'Meeting', icon: FileText, color: 'text-blue-400', glowColor: '59, 130, 246' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'text-green-400', glowColor: '34, 197, 94' },
  { id: 'email', label: 'E-Mail', icon: Mail, color: 'text-pink-400', glowColor: '236, 72, 153' },
  { id: 'ticket', label: 'Ticket', icon: Ticket, color: 'text-orange-400', glowColor: '251, 146, 60' },
  { id: 'devnote', label: 'Dev', icon: Code, color: 'text-cyan-400', glowColor: '34, 211, 238' },
  { id: 'clean', label: 'Clean', icon: Sparkles, color: 'text-purple-400', glowColor: '168, 85, 247' },
  { id: 'reminder', label: 'Erinnerung', icon: Bell, color: 'text-yellow-400', glowColor: '250, 204, 21' },
];

interface ModeCarouselProps {
  /** Currently highlighted/active mode */
  activeMode?: ModeId | null;
  /** Suggested mode from LLM */
  suggestedMode?: ModeId | null;
  /** Callback when mode is clicked */
  onModeSelect?: (mode: ModeId) => void;
  className?: string;
}

/**
 * ModeCarousel - Horizontal scrollable mode selector
 *
 * Features:
 * - Horizontal scroll with drag support
 * - Active mode highlighting with glow
 * - Suggested mode pulsing animation
 * - Icon + label for each mode
 */
export function ModeCarousel({
  activeMode,
  suggestedMode,
  onModeSelect,
  className
}: ModeCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={clsx('relative w-full', className)}>
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-bg-secondary to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg-secondary to-transparent z-10 pointer-events-none" />

      {/* Scrollable container */}
      <motion.div
        ref={scrollRef}
        className="flex items-center gap-2 px-8 py-2 overflow-x-auto scrollbar-hide"
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={0.1}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          const isSuggested = suggestedMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              onClick={() => onModeSelect?.(mode.id)}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                'min-w-[60px]',
                isActive && 'bg-surface-active',
                !isActive && 'hover:bg-surface-hover'
              )}
            >
              {/* Suggestion pulse ring */}
              {isSuggested && !isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    boxShadow: `0 0 20px rgba(${mode.glowColor}, 0.5)`,
                  }}
                  animate={{
                    opacity: [0.3, 0.8, 0.3],
                    scale: [0.95, 1.02, 0.95],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}

              {/* Active glow */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    boxShadow: `0 0 25px rgba(${mode.glowColor}, 0.6)`,
                    background: `radial-gradient(circle, rgba(${mode.glowColor}, 0.15) 0%, transparent 70%)`,
                  }}
                />
              )}

              {/* Icon */}
              <div
                className={clsx(
                  'relative w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                  isActive ? 'bg-white/10' : 'bg-surface-glass'
                )}
              >
                <Icon
                  className={clsx(
                    'w-4 h-4 transition-colors',
                    isActive ? mode.color : 'text-muted'
                  )}
                />

                {/* Active indicator dot */}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: `rgb(${mode.glowColor})` }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={clsx(
                  'text-[10px] font-medium transition-colors',
                  isActive ? mode.color : 'text-muted'
                )}
              >
                {mode.label}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

/**
 * Get mode config by ID
 */
export function getModeConfig(modeId: ModeId): ModeConfig | undefined {
  return MODES.find(m => m.id === modeId);
}

/**
 * Save success animation - call this after saving to a mode
 */
export function SaveSuccessAnimation({ mode, onComplete }: { mode: ModeId; onComplete?: () => void }) {
  const config = getModeConfig(mode);
  if (!config) return null;

  const Icon = config.icon;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Icon with expanding ring */}
          <div className="relative">
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 60px rgba(${config.glowColor}, 0.8)`,
              }}
              animate={{
                scale: [1, 2, 3],
                opacity: [0.8, 0.4, 0],
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, rgba(${config.glowColor}, 0.3), rgba(${config.glowColor}, 0.1))`,
                boxShadow: `0 0 30px rgba(${config.glowColor}, 0.5)`,
              }}
            >
              <Icon className={clsx('w-8 h-8', config.color)} />
            </div>
          </div>

          {/* Success text */}
          <motion.p
            className={clsx('text-sm font-medium', config.color)}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Gespeichert in {config.label}
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
