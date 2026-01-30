'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import clsx from 'clsx';
import { useCopy } from '@/lib/hooks/useCopy';
import { getModeConfig, type ModeId } from './ModeRail';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PlanCard } from './PlanCard';
import type { PlanData } from '../../electron/shared/types';

interface ArtifactCardProps {
  mode?: ModeId;
  markdown: string;
  data?: unknown; // Structured data from enrichment result
  messageId?: string; // For plan task persistence
  timestamp?: Date;
  defaultExpanded?: boolean;
  isActive?: boolean;
}

export function ArtifactCard({
  mode = 'meeting',
  markdown,
  data,
  messageId,
  timestamp,
  defaultExpanded = true,
  isActive = false,
}: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const config = getModeConfig(mode);
  const Icon = config?.icon;
  const accentColor = config?.glowColor || '139, 92, 246';

  // Use PlanCard for plan mode if structured data exists
  if (mode === 'plan' && data && isPlanData(data)) {
    return (
      <PlanCard
        data={data}
        markdown={markdown}
        messageId={messageId}
        timestamp={timestamp}
        defaultExpanded={defaultExpanded}
      />
    );
  }

  // Extract first line as title preview (for collapsed state)
  const firstLine = markdown.split('\n')[0]?.replace(/^#+\s*/, '').slice(0, 60) || 'Ergebnis';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    copy(markdown);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'w-full rounded-xl overflow-hidden glass-strong',
        isActive && 'ring-1 ring-primary/30'
      )}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: `rgba(${accentColor}, 0.6)`,
      }}
    >
      {/* Header - always visible, clickable */}
      <button
        onClick={toggleExpand}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 text-left',
          'hover:bg-surface-hover transition-colors',
          isExpanded && 'border-b border-border'
        )}
      >
        {/* Mode icon */}
        {Icon && (
          <div
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `rgba(${accentColor}, 0.15)` }}
          >
            <Icon className={clsx('w-3.5 h-3.5', config?.color)} />
          </div>
        )}

        {/* Title and metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {config?.label || 'Output'}
            </span>
            {timestamp && (
              <span className="text-xs text-muted shrink-0">
                {timestamp.toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          {!isExpanded && (
            <p className="text-xs text-muted truncate mt-0.5">{firstLine}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Copy button */}
          <div
            onClick={handleCopy}
            className={clsx(
              'p-1.5 rounded-lg transition-all cursor-pointer',
              'hover:bg-surface-active',
              copied ? 'text-success' : 'text-muted hover:text-text-primary'
            )}
            title="Kopieren"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </div>

          {/* Expand/collapse indicator */}
          <div className="p-1.5 text-muted">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </button>

      {/* Content - collapsible */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2.5 max-h-[300px] overflow-y-auto">
              <div className="text-sm text-text-secondary">
                <MarkdownRenderer content={markdown} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Type guard to check if data is valid PlanData
function isPlanData(data: unknown): data is PlanData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.projectName === 'string' &&
    typeof d.goal === 'string' &&
    Array.isArray(d.milestones) &&
    d.milestones.length > 0
  );
}
