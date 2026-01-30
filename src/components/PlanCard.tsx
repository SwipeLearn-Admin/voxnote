'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Target,
  AlertTriangle,
  HelpCircle,
  Zap,
  Calendar,
} from 'lucide-react';
import clsx from 'clsx';
import { useCopy } from '@/lib/hooks/useCopy';
import { useAppStore } from '@/lib/store';
import type {
  PlanData,
  PlanMilestone,
  PlanTask,
  TaskPriority,
} from '../../electron/shared/types';

interface PlanCardProps {
  data: PlanData;
  markdown: string;
  messageId?: string; // For task toggle persistence
  timestamp?: Date;
  defaultExpanded?: boolean;
}

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string; dot: string }> = {
  high: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
};

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

const ESTIMATE_LABELS: Record<string, string> = {
  XS: '< 1h',
  S: '1-4h',
  M: '4-8h',
  L: '1-2d',
  XL: '2d+',
};

function TaskRow({
  task,
  onToggle,
}: {
  task: PlanTask;
  onToggle?: (taskId: string) => void;
}) {
  // Guard against undefined task
  if (!task) return null;

  const isDone = task.status === 'done';
  const priority = PRIORITY_COLORS[task.priority || 'medium'];

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-3 py-2 rounded-lg transition-colors',
        isDone ? 'opacity-60' : 'hover:bg-surface-hover'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle?.(task.id)}
        className={clsx(
          'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
          isDone
            ? 'border-green-500 bg-green-500/20 text-green-400'
            : 'border-white/30 hover:border-white/50'
        )}
      >
        {isDone && <Check className="w-3 h-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-sm',
              isDone ? 'line-through text-white/50' : 'text-white/90'
            )}
          >
            {task.title}
          </span>
          {/* Estimate badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">
            {ESTIMATE_LABELS[task.estimate] || task.estimate}
          </span>
          {/* Priority dot */}
          <span
            className={clsx('w-2 h-2 rounded-full', priority.dot)}
            title={task.priority}
          />
        </div>
        {task.description && (
          <p className="text-xs text-white/50 mt-0.5">{task.description}</p>
        )}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {task.acceptanceCriteria.map((ac, i) => {
              const acText = typeof ac === 'string' ? ac : String(ac ?? '');
              if (!acText.trim()) return null;
              return (
                <li key={i} className="text-xs text-white/40 flex items-start gap-1">
                  <span className="text-white/30">•</span>
                  {acText}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MilestoneSection({
  milestone,
  index,
  onTaskToggle,
}: {
  milestone: PlanMilestone;
  index: number;
  onTaskToggle?: (taskId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0); // First milestone expanded by default

  // Handle missing data gracefully
  const priority = PRIORITY_COLORS[milestone?.priority || 'medium'];
  const tasks = milestone?.tasks || [];
  const completedTasks = tasks.filter((t) => t?.status === 'done').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Guard against undefined milestone - after hooks
  if (!milestone) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Milestone Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 text-left',
          'hover:bg-surface-hover transition-colors'
        )}
      >
        {/* Expand icon */}
        <div className="text-white/50">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>

        {/* Milestone number */}
        <div
          className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium',
            priority.bg,
            priority.text
          )}
        >
          M{index + 1}
        </div>

        {/* Title and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {milestone.name}
            </span>
            <span className="text-xs">{PRIORITY_ICONS[milestone?.priority || 'medium']}</span>
          </div>
          {milestone.description && (
            <p className="text-xs text-white/50 truncate">{milestone.description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-white/50 min-w-[3rem] text-right">
            {completedTasks}/{totalTasks}
          </span>
        </div>
      </button>

      {/* Tasks */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1 border-t border-border pt-2">
              {tasks.map((task) => (
                <TaskRow key={task?.id || Math.random()} task={task} onToggle={onTaskToggle} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PlanCard({
  data,
  markdown,
  messageId,
  timestamp,
  defaultExpanded = true,
}: PlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();
  const togglePlanTask = useAppStore((state) => state.togglePlanTask);

  // Calculate overall progress (handle missing status gracefully)
  const allTasks = (data.milestones || []).flatMap((m) => m?.tasks || []);
  const completedTasks = allTasks.filter((t) => t?.status === 'done').length;
  const totalTasks = allTasks.length;
  const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleCopy = () => {
    copy(markdown);
  };

  const handleTaskToggle = (taskId: string) => {
    if (messageId) {
      togglePlanTask(messageId, taskId);
    }
  };

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-indigo-400" />
        </div>

        {/* Title and meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">
              {data.projectName}
            </h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="text-xs text-white/60 truncate">{data.goal}</p>
        </div>

        {/* Overall progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-lg font-semibold text-white">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-[10px] text-white/40">
              {completedTasks}/{totalTasks} Tasks
            </div>
          </div>
          <button
            onClick={handleCopy}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
            title="Kopieren"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
              {/* Target Date */}
              {data.targetDate && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Ziel:{' '}
                    {new Date(data.targetDate).toLocaleDateString('de-DE', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* Milestones */}
              {(data.milestones?.length || 0) > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Meilensteine
                  </h4>
                  {data.milestones?.map((milestone, i) => (
                    <MilestoneSection
                      key={milestone?.id || i}
                      milestone={milestone}
                      index={i}
                      onTaskToggle={handleTaskToggle}
                    />
                  ))}
                </div>
              )}

              {/* Next Steps */}
              {data.nextSteps?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    Nächste Schritte
                  </h4>
                  <ol className="space-y-1">
                    {data.nextSteps?.map((step, i) => {
                      // Defensive: ensure step is a non-empty string
                      const stepText = typeof step === 'string' ? step : String(step ?? '');
                      if (!stepText.trim()) return null;
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-white/80"
                        >
                          <span className="text-indigo-400 font-medium min-w-[1.25rem]">
                            {i + 1}.
                          </span>
                          <span>{stepText}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* Risks */}
              {data.risks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    Risiken
                  </h4>
                  <div className="space-y-2">
                    {data.risks?.map((risk, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={clsx(
                              'text-xs px-1.5 py-0.5 rounded',
                              risk.impact === 'high'
                                ? 'bg-red-500/20 text-red-400'
                                : risk.impact === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                            )}
                          >
                            {risk.impact}
                          </span>
                          <span className="text-sm text-white/80 flex-1">
                            {risk.description}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1 pl-[52px]">
                          Mitigation: {risk.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Questions */}
              {data.openQuestions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3 h-3" />
                    Offene Fragen
                  </h4>
                  <ul className="space-y-1">
                    {data.openQuestions?.map((q, i) => {
                      const qText = typeof q === 'string' ? q : String(q ?? '');
                      if (!qText.trim()) return null;
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-white/70"
                        >
                          <span className="text-white/30">•</span>
                          {qText}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
