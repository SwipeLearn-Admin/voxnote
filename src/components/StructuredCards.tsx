'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Users,
  CheckSquare,
  Clock,
  Bell,
  Mail,
  Bug,
  Code,
  FileText,
  Calendar,
  AlertCircle,
  HelpCircle,
  User,
} from 'lucide-react';
import clsx from 'clsx';
import { useCopy } from '@/lib/hooks/useCopy';

// ===========================================
// SHARED TYPES
// ===========================================

interface BaseCardProps {
  markdown: string;
  timestamp?: Date;
  defaultExpanded?: boolean;
}

// ===========================================
// MEETING CARD
// ===========================================

interface MeetingData {
  summary?: string;
  decisions?: string[];
  actionItems?: Array<{ task: string; owner?: string | null; due?: string | null }>;
  openQuestions?: string[];
}

export function MeetingCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: MeetingData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const actionItems = data.actionItems || [];
  const decisions = data.decisions || [];
  const openQuestions = data.openQuestions || [];

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Meeting-Notiz</h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {data.summary && <p className="text-xs text-white/60 truncate">{data.summary}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actionItems.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
              {actionItems.length} Tasks
            </span>
          )}
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {/* Summary */}
              {data.summary && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">Zusammenfassung</h4>
                  <p className="text-sm text-white/80">{data.summary}</p>
                </div>
              )}

              {/* Decisions */}
              {decisions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3 h-3" />
                    Entscheidungen
                  </h4>
                  <ul className="space-y-1">
                    {decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                        <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {actionItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3 h-3" />
                    Action Items
                  </h4>
                  <div className="space-y-1">
                    {actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-surface hover:bg-surface-hover">
                        <div className="w-5 h-5 rounded border-2 border-white/30 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white/90">{item.task}</span>
                          <div className="flex items-center gap-3 mt-1">
                            {item.owner && (
                              <span className="text-xs text-white/50 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {item.owner}
                              </span>
                            )}
                            {item.due && (
                              <span className="text-xs text-white/50 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {item.due}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Questions */}
              {openQuestions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3 h-3" />
                    Offene Fragen
                  </h4>
                  <ul className="space-y-1">
                    {openQuestions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="text-white/30">?</span>
                        {q}
                      </li>
                    ))}
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

// ===========================================
// TASKS CARD
// ===========================================

interface TasksData {
  tasks?: Array<{ task: string; owner?: string | null; due?: string | null; priority?: string }>;
}

const TASK_PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

export function TasksCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: TasksData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const tasks = data.tasks || [];

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Aufgaben</h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-xs text-white/60">{tasks.length} Aufgaben extrahiert</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover">
                  <div className="w-5 h-5 rounded border-2 border-white/30 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/90">{task.task}</span>
                      {task.priority && (
                        <span className={clsx('w-2 h-2 rounded-full', TASK_PRIORITY_COLORS[task.priority] || 'bg-gray-500')} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {task.owner && (
                        <span className="text-xs text-white/50 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.owner}
                        </span>
                      )}
                      {task.due && (
                        <span className="text-xs text-white/50 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.due}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-white/50 text-center py-4">Keine Aufgaben gefunden</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// REMINDER CARD
// ===========================================

interface ReminderData {
  what?: string;
  when?: string | null;
  whenRaw?: string;
  recurring?: boolean;
}

export function ReminderCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: ReminderData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const formattedDate = data.when
    ? new Date(data.when).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/20 flex items-center justify-center">
          <Bell className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Erinnerung</h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {data.what && <p className="text-xs text-white/60 truncate">{data.what}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* What */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <Bell className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">{data.what || 'Keine Beschreibung'}</p>
                  {data.recurring && (
                    <span className="text-xs text-yellow-400 mt-1 inline-block">Wiederkehrend</span>
                  )}
                </div>
              </div>

              {/* When */}
              {(formattedDate || data.whenRaw) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface">
                  <Clock className="w-5 h-5 text-white/50" />
                  <div>
                    <p className="text-sm text-white/90">{formattedDate || data.whenRaw}</p>
                    {data.whenRaw && formattedDate && (
                      <p className="text-xs text-white/50">&quot;{data.whenRaw}&quot;</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// EMAIL CARD
// ===========================================

interface EmailData {
  subject?: string;
  to?: string | null;
  body?: string;
}

export function EmailCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: EmailData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-pink-500/20 flex items-center justify-center">
          <Mail className="w-5 h-5 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">E-Mail</h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {data.subject && <p className="text-xs text-white/60 truncate">{data.subject}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* To */}
              {data.to && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/50">An:</span>
                  <span className="text-white/90">{data.to}</span>
                </div>
              )}
              {/* Subject */}
              {data.subject && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-white/50">Betreff:</span>
                  <span className="text-white/90 font-medium">{data.subject}</span>
                </div>
              )}
              {/* Body */}
              {data.body && (
                <div className="mt-3 px-4 py-3 rounded-xl bg-surface border border-border">
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{data.body}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// TICKET CARD
// ===========================================

interface TicketData {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  labels?: string[];
  priority?: string;
}

export function TicketCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: TicketData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const priorityColor = data.priority === 'high' ? 'text-red-400' : data.priority === 'medium' ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Bug className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Ticket</h3>
            {data.priority && (
              <span className={clsx('text-xs', priorityColor)}>{data.priority}</span>
            )}
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {data.title && <p className="text-xs text-white/60 truncate">{data.title}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {/* Title */}
              {data.title && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">Titel</h4>
                  <p className="text-sm font-medium text-white">{data.title}</p>
                </div>
              )}

              {/* Description */}
              {data.description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">Beschreibung</h4>
                  <p className="text-sm text-white/80">{data.description}</p>
                </div>
              )}

              {/* Acceptance Criteria */}
              {data.acceptanceCriteria && data.acceptanceCriteria.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider">Akzeptanzkriterien</h4>
                  <div className="space-y-1">
                    {data.acceptanceCriteria.map((ac, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface">
                        <div className="w-4 h-4 rounded border border-white/30 shrink-0 mt-0.5" />
                        <span className="text-sm text-white/80">{ac}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Labels */}
              {data.labels && data.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.labels.map((label, i) => (
                    <span key={i} className="px-2 py-1 text-xs rounded-full bg-orange-500/20 text-orange-400">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// DEVNOTE CARD
// ===========================================

interface DevNoteData {
  changeType?: string;
  breaking?: boolean;
  affectedFiles?: string[];
}

const CHANGE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  feature: { bg: 'bg-green-500/20', text: 'text-green-400' },
  bugfix: { bg: 'bg-red-500/20', text: 'text-red-400' },
  refactor: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  docs: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  test: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  chore: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

export function DevNoteCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: DevNoteData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  const typeStyle = CHANGE_TYPE_COLORS[data.changeType || 'chore'] || CHANGE_TYPE_COLORS.chore;

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
          <Code className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Dev Note</h3>
            {data.changeType && (
              <span className={clsx('text-xs px-2 py-0.5 rounded', typeStyle.bg, typeStyle.text)}>
                {data.changeType}
              </span>
            )}
            {data.breaking && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">BREAKING</span>
            )}
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {/* Affected Files */}
              {data.affectedFiles && data.affectedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3 h-3" />
                    Betroffene Dateien
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data.affectedFiles.map((file, i) => (
                      <code key={i} className="px-2 py-1 text-xs rounded bg-surface text-cyan-400 font-mono">
                        {file}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// CLEAN CARD (simple, just word count)
// ===========================================

interface CleanData {
  wordCount?: number;
}

export function CleanCard({
  data,
  markdown,
  timestamp,
  defaultExpanded = true,
}: BaseCardProps & { data: CleanData }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { copy, copied } = useCopy();

  return (
    <div className="w-full rounded-xl overflow-hidden glass-strong">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">Bereinigter Text</h3>
            {timestamp && (
              <span className="text-xs text-white/40">
                {timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {data.wordCount && <p className="text-xs text-white/60">{data.wordCount} Wörter</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => copy(markdown)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              copied ? 'text-green-400' : 'text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 max-h-[400px] overflow-y-auto">
              <div className="px-4 py-3 rounded-xl bg-surface border border-border">
                <p className="text-sm text-white/80 whitespace-pre-wrap">{markdown.replace(/^##.*\n\n?/, '')}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
