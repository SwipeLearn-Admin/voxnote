'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Plus, X, Search, Edit2, Check } from 'lucide-react';
import * as ipc from '@/lib/ipc';
import type { Entity } from '../../electron/shared/types';

interface ContactsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ContactsPanel({ open, onClose }: ContactsPanelProps) {
  const { activeProjectId } = useAppStore();

  const [contacts, setContacts] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New contact form
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Edit form
  const [editNotes, setEditNotes] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load contacts when panel opens
  useEffect(() => {
    if (open && activeProjectId) {
      loadContacts();
    }
  }, [open, activeProjectId]);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAdding) {
          setIsAdding(false);
          setNewName('');
          setNewNotes('');
        } else if (editingId) {
          setEditingId(null);
          setEditNotes('');
        } else {
          onClose();
        }
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, isAdding, editingId, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, onClose]);

  const loadContacts = async () => {
    if (!activeProjectId) return;

    setLoading(true);
    try {
      const entities = await ipc.memoryListEntities(activeProjectId, 'person');
      setContacts(entities);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!activeProjectId || !newName.trim()) return;

    try {
      const created = await ipc.memoryCreateEntity({
        project_id: activeProjectId,
        type: 'person',
        name: newName.trim(),
        context: newNotes.trim() || undefined,
      });

      if (created) {
        setContacts((prev) => [...prev, created]);
        setIsAdding(false);
        setNewName('');
        setNewNotes('');
      }
    } catch (error) {
      console.error('Failed to create contact:', error);
    }
  };

  const handleUpdateNotes = async (contactId: string) => {
    if (!activeProjectId) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    try {
      const updated = await ipc.memoryUpsertEntity(activeProjectId, {
        type: 'person',
        name: contact.name,
        context: editNotes.trim() || undefined,
        aliases: contact.aliases,
      });

      if (updated) {
        setContacts((prev) =>
          prev.map((c) => (c.id === contactId ? { ...c, context: editNotes.trim() } : c))
        );
      }
    } catch (error) {
      console.error('Failed to update contact:', error);
    } finally {
      setEditingId(null);
      setEditNotes('');
    }
  };

  const startEditing = (contact: Entity) => {
    setEditingId(contact.id);
    setEditNotes(contact.context || '');
  };

  // Filter contacts by search
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.context?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.aliases?.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-sm bg-zinc-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-medium text-white flex items-center gap-2">
            <User className="w-4 h-4" />
            Kontakte
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* No project warning */}
        {!activeProjectId && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-white/50">
              Wähle zuerst ein Projekt aus, um Kontakte zu sehen.
            </p>
          </div>
        )}

        {/* Search */}
        {activeProjectId && !isAdding && (
          <div className="px-4 py-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suchen..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[300px] overflow-y-auto">
          {isAdding ? (
            // Add form
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name *</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newName.trim()) {
                      handleAddContact();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Notizen (optional)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="z.B. Projektleiter, mag keinen Kaffee"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewName('');
                    setNewNotes('');
                  }}
                  className="flex-1 px-3 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAddContact}
                  disabled={!newName.trim()}
                  className="flex-1 px-3 py-2 text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          ) : activeProjectId ? (
            <div className="p-2">
              {loading ? (
                <div className="px-3 py-4 text-center text-sm text-white/40">
                  Laden...
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-white/40">
                  {searchQuery ? 'Keine Kontakte gefunden' : 'Noch keine Kontakte'}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white truncate">
                            {contact.name}
                          </span>
                          {editingId !== contact.id && (
                            <button
                              onClick={() => startEditing(contact)}
                              className="p-1 text-white/30 hover:text-white/70 rounded"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {editingId === contact.id ? (
                          <div className="mt-1 flex gap-2">
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Notizen..."
                              className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateNotes(contact.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleUpdateNotes(contact.id)}
                              className="p-1 text-green-400 hover:text-green-300"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditNotes('');
                              }}
                              className="p-1 text-white/30 hover:text-white/70"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : contact.context ? (
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {contact.context}
                          </p>
                        ) : null}

                        {contact.aliases && contact.aliases.length > 0 && (
                          <p className="text-xs text-white/30 truncate mt-0.5">
                            auch: {contact.aliases.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {activeProjectId && !isAdding && (
          <div className="px-2 py-2 border-t border-white/10">
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Kontakt hinzufügen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
