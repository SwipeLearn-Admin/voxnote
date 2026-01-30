'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { SuggestedAction } from '@/lib/store';

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onSelect?: (actionId: string) => void;
  variant?: 'default' | 'error';
}

export function SuggestedActions({ actions, onSelect, variant = 'default' }: SuggestedActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03, duration: 0.15 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect?.(action.id)}
          className={clsx(
            'px-3.5 py-1.5 text-sm font-medium rounded-full',
            'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent',
            {
              // Default variant - glass with primary accent
              'glass border-primary/20 text-primary hover:bg-primary/15 hover:border-primary/40 focus:ring-primary/50':
                variant === 'default',
              // Error variant - subtle danger accent
              'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 hover:border-danger/30 focus:ring-danger/50':
                variant === 'error',
            }
          )}
        >
          {action.label}
        </motion.button>
      ))}
    </div>
  );
}
