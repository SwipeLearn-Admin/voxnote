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
import type { ModeId } from '../../electron/shared/types';

interface ModeConfig {
  id: ModeId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string;
  glowColor: string;
  hotkey: string;
}

export const MODES: ModeConfig[] = [
  { id: 'meeting', label: 'Meeting', shortLabel: 'Meet', icon: FileText, color: 'text-blue-400', glowColor: '59, 130, 246', hotkey: '1' },
  { id: 'tasks', label: 'Tasks', shortLabel: 'Task', icon: CheckSquare, color: 'text-green-400', glowColor: '34, 197, 94', hotkey: '2' },
  { id: 'email', label: 'E-Mail', shortLabel: 'Mail', icon: Mail, color: 'text-pink-400', glowColor: '236, 72, 153', hotkey: '3' },
  { id: 'ticket', label: 'Ticket', shortLabel: 'Tick', icon: Ticket, color: 'text-orange-400', glowColor: '251, 146, 60', hotkey: '4' },
  { id: 'devnote', label: 'Dev', shortLabel: 'Dev', icon: Code, color: 'text-cyan-400', glowColor: '34, 211, 238', hotkey: '5' },
  { id: 'clean', label: 'Clean', shortLabel: 'Clean', icon: Sparkles, color: 'text-purple-400', glowColor: '168, 85, 247', hotkey: '6' },
  { id: 'reminder', label: 'Reminder', shortLabel: 'Rem', icon: Bell, color: 'text-yellow-400', glowColor: '250, 204, 21', hotkey: '7' },
  { id: 'plan', label: 'Plan', shortLabel: 'Plan', icon: ClipboardList, color: 'text-indigo-400', glowColor: '99, 102, 241', hotkey: '8' },
];

// Helper to get mode by hotkey
export function getModeByHotkey(key: string): ModeConfig | undefined {
  return MODES.find((m) => m.hotkey === key);
}

export function getModeConfig(modeId: ModeId): ModeConfig | undefined {
  return MODES.find((m) => m.id === modeId);
}

interface ModeDockProps {
  activeMode?: ModeId | null;
  suggestedMode?: ModeId | null;
  onModeSelect?: (mode: ModeId) => void;
  className?: string;
}

/**
 * ModeDock - Horizontal mode buttons row at bottom of chat
 */
export function ModeDock({
  activeMode,
  suggestedMode,
  onModeSelect,
  className,
}: ModeDockProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-1 py-2 px-2',
        className
      )}
    >
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = activeMode === mode.id;
        const isSuggested = suggestedMode === mode.id && !isActive;

        return (
          <motion.button
            key={mode.id}
            onClick={() => onModeSelect?.(mode.id)}
            whileTap={{ scale: 0.9 }}
            className={clsx(
              'relative w-9 h-9 rounded-xl flex items-center justify-center',
              'transition-all duration-150',
              isActive && 'bg-white/10',
              !isActive && 'hover:bg-white/5'
            )}
            title={mode.label}
          >
            {/* Suggestion pulse animation */}
            {isSuggested && (
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
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

            {/* Active glow */}
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  boxShadow: `0 0 20px rgba(${mode.glowColor}, 0.6), inset 0 0 15px rgba(${mode.glowColor}, 0.2)`,
                }}
              />
            )}

            {/* Icon */}
            <Icon
              className={clsx(
                'w-4 h-4 transition-colors relative z-10',
                isActive ? mode.color : isSuggested ? mode.color : 'text-white/40'
              )}
            />
          </motion.button>
        );
      })}
    </div>
  );
}
