'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  CheckSquare,
  Mail,
  Ticket,
  Code,
  Sparkles,
  Bell,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

export type ModeId = 'meeting' | 'tasks' | 'email' | 'ticket' | 'devnote' | 'clean' | 'reminder' | 'plan';

interface ModeConfig {
  id: ModeId;
  label: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
}

const MODES: ModeConfig[] = [
  { id: 'meeting', label: 'Meeting', icon: FileText, color: 'text-blue-400', glowColor: '59, 130, 246' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'text-green-400', glowColor: '34, 197, 94' },
  { id: 'email', label: 'E-Mail', icon: Mail, color: 'text-pink-400', glowColor: '236, 72, 153' },
  { id: 'ticket', label: 'Ticket', icon: Ticket, color: 'text-orange-400', glowColor: '251, 146, 60' },
  { id: 'devnote', label: 'Dev', icon: Code, color: 'text-cyan-400', glowColor: '34, 211, 238' },
  { id: 'clean', label: 'Clean', icon: Sparkles, color: 'text-purple-400', glowColor: '168, 85, 247' },
  { id: 'reminder', label: 'Erinnerung', icon: Bell, color: 'text-yellow-400', glowColor: '250, 204, 21' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, color: 'text-indigo-400', glowColor: '99, 102, 241' },
];

interface ModeRailProps {
  /** Currently active/selected mode */
  activeMode?: ModeId | null;
  /** Mode suggested by LLM (will pulse) */
  suggestedMode?: ModeId | null;
  /** Awaiting Y/N confirmation */
  awaitingConfirmation?: boolean;
  /** Callback when mode is clicked */
  onModeSelect?: (mode: ModeId) => void;
  className?: string;
}

/**
 * ModeRail - Vertical icon sidebar for mode selection
 *
 * Features:
 * - Compact vertical layout (left side of screen)
 * - Icon-only with tooltip on hover
 * - Pulsing glow when mode is suggested
 * - Solid glow when awaiting confirmation
 */
export function ModeRail({
  activeMode,
  suggestedMode,
  awaitingConfirmation = false,
  onModeSelect,
  className,
}: ModeRailProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-1 py-2 px-1.5',
        'bg-bg-secondary/50 backdrop-blur-sm',
        'border-r border-border/50',
        className
      )}
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        const isSuggested = suggestedMode === mode.id;
        const showConfirmGlow = isSuggested && awaitingConfirmation;

        return (
          <motion.button
            key={mode.id}
            onClick={() => onModeSelect?.(mode.id)}
            whileTap={{ scale: 0.9 }}
            className={clsx(
              'relative w-9 h-9 rounded-lg flex items-center justify-center',
              'transition-all duration-150',
              isActive && 'bg-surface-active',
              !isActive && 'hover:bg-surface-hover'
            )}
            title={mode.label}
          >
            {/* Suggestion pulse animation */}
            {isSuggested && !showConfirmGlow && (
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{
                  boxShadow: `0 0 12px rgba(${mode.glowColor}, 0.6)`,
                }}
                animate={{
                  opacity: [0.4, 0.9, 0.4],
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Confirmation glow (solid, brighter) */}
            {showConfirmGlow && (
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  boxShadow: `0 0 20px rgba(${mode.glowColor}, 0.8), 0 0 40px rgba(${mode.glowColor}, 0.4)`,
                  background: `radial-gradient(circle, rgba(${mode.glowColor}, 0.2) 0%, transparent 70%)`,
                }}
              />
            )}

            {/* Active indicator */}
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-lg pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  boxShadow: `0 0 15px rgba(${mode.glowColor}, 0.5)`,
                }}
              />
            )}

            {/* Icon */}
            <Icon
              className={clsx(
                'w-4 h-4 transition-colors relative z-10',
                isActive || isSuggested ? mode.color : 'text-muted'
              )}
            />

            {/* Active dot indicator */}
            {isActive && (
              <motion.div
                className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
                style={{ backgroundColor: `rgb(${mode.glowColor})` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * Get mode config by ID
 */
export function getModeConfig(modeId: ModeId): ModeConfig | undefined {
  return MODES.find((m) => m.id === modeId);
}

export { MODES };
