'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trash2, Copy, Search, AlertTriangle, Clock, Check, FileText, CheckSquare, Mail, Ticket, Code, Sparkles, Bell } from 'lucide-react';
import type { ModeId } from '../../electron/shared/types';
import { useAppStore, MODE_ACTIONS } from '@/lib/store';
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/markdown';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';

// Mode filter tabs configuration
const MODE_TABS: { id: ModeId | 'all'; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'Alle', icon: Clock },
  { id: 'meeting', label: 'Meeting', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'ticket', label: 'Ticket', icon: Ticket },
  { id: 'devnote', label: 'Dev', icon: Code },
  { id: 'clean', label: 'Clean', icon: Sparkles },
  { id: 'reminder', label: 'Reminder', icon: Bell },
];

export function HistoryDrawer() {
  const {
    historyOpen,
    historyItems,
    toggleHistory,
    openHistoryItem,
    deleteHistoryEntry,
    clearAllHistory,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ModeId | 'all'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = historyItems.filter((item) => {
    // Filter by mode tab
    if (activeTab !== 'all' && item.mode !== activeTab) {
      return false;
    }
    // Filter by search
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.transcript.toLowerCase().includes(searchLower) ||
      item.result.markdown.toLowerCase().includes(searchLower) ||
      item.title?.toLowerCase().includes(searchLower) ||
      item.context?.toLowerCase().includes(searchLower)
    );
  });

  const handleCopy = async (id: string, markdown: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await ipc.copyToClipboard(markdown);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHistoryEntry(id);
  };

  const getModeLabel = (modeId: string) => {
    const mode = MODE_ACTIONS.find((m) => m.id === modeId);
    return mode?.label || modeId;
  };

  const getModeIcon = (modeId: string) => {
    const tab = MODE_TABS.find((t) => t.id === modeId);
    return tab?.icon || FileText;
  };

  if (!historyOpen) {
    return null;
  }

  return (
    <div className="relative z-10 h-full w-[320px] shrink-0 bg-bg-secondary/95 backdrop-blur-xl border-l border-border flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-text-primary">History</h2>
          <span className="text-xs text-muted">{historyItems.length} Einträge</span>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen..."
              className="w-full glass rounded-xl pl-9 pr-3 py-2 text-sm text-text-primary placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Mode Filter Tabs */}
        <div className="px-2 py-2 border-b border-border shrink-0 overflow-x-auto">
          <div className="flex gap-1">
            {MODE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = tab.id === 'all'
                ? historyItems.length
                : historyItems.filter((i) => i.mode === tab.id).length;

              if (tab.id !== 'all' && count === 0) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-all',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted hover:text-text-secondary hover:bg-surface-hover'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={clsx(
                      'px-1 rounded text-[10px]',
                      isActive ? 'bg-primary/20' : 'bg-surface-glass'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full text-muted p-4"
              >
                <Clock className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm text-center">
                  {search ? 'Keine Treffer' : 'Noch keine Einträge'}
                </p>
              </motion.div>
            ) : (
              <div className="divide-y divide-border">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => openHistoryItem(item)}
                    className="px-3 py-3 hover:bg-surface-hover cursor-pointer transition-colors group"
                  >
                    {/* Top row: mode + time */}
                    <div className="flex items-center justify-between mb-1.5">
                      {(() => {
                        const ModeIcon = getModeIcon(item.mode);
                        return (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/15 text-primary text-xs rounded-full font-medium">
                            <ModeIcon className="w-3 h-3" />
                            {getModeLabel(item.mode)}
                          </span>
                        );
                      })()}
                      <span
                        className="text-xs text-muted"
                        title={formatAbsoluteTime(item.createdAt)}
                      >
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Title/preview */}
                    <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                      {item.title || item.transcript.slice(0, 60)}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleCopy(item.id, item.result.markdown, e)}
                        className="p-1.5 hover:bg-surface-active rounded-lg text-muted hover:text-text-primary transition-colors"
                        title="Ergebnis kopieren"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1.5 hover:bg-danger/15 rounded-lg text-muted hover:text-danger transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <AnimatePresence>
          {historyItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 py-2.5 border-t border-border shrink-0"
            >
              {showClearConfirm ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                  <span className="text-xs text-warning flex-1">Alles löschen?</span>
                  <button
                    onClick={() => {
                      clearAllHistory();
                      setShowClearConfirm(false);
                    }}
                    className="px-2.5 py-1 bg-danger/15 hover:bg-danger/25 text-danger text-xs rounded-lg transition-colors"
                  >
                    Ja
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 glass glass-hover text-text-primary text-xs rounded-lg transition-colors"
                  >
                    Nein
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full px-3 py-2 glass glass-hover text-muted hover:text-danger text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Alle löschen
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
