'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Folder, Plus, Check, X, FolderOpen } from 'lucide-react';
import type { Project } from '../../electron/shared/types';

export function ProjectSwitcher() {
  const {
    projectSwitcherOpen,
    setProjectSwitcherOpen,
    projects,
    activeProjectId,
    setActiveProject,
    createProject,
    loadProjects,
    // Disambiguation (M4)
    pendingDisambiguation,
    resolveDisambiguation,
    setPendingDisambiguation,
  } = useAppStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load projects on mount
  useEffect(() => {
    if (projectSwitcherOpen && projects.length === 0) {
      loadProjects();
    }
  }, [projectSwitcherOpen, projects.length, loadProjects]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          setIsCreating(false);
          setNewProjectName('');
          setNewProjectDescription('');
        } else {
          setProjectSwitcherOpen(false);
        }
      }
    };

    if (projectSwitcherOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [projectSwitcherOpen, isCreating, setProjectSwitcherOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setProjectSwitcherOpen(false);
      }
    };

    if (projectSwitcherOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [projectSwitcherOpen, setProjectSwitcherOpen]);

  const handleSelectProject = async (project: Project | null) => {
    // Check if we're resolving a disambiguation
    if (pendingDisambiguation && project) {
      // Resolve disambiguation with selected project
      await resolveDisambiguation(project.id);
      // resolveDisambiguation already closes the switcher
    } else if (pendingDisambiguation && !project) {
      // User selected "no project" during disambiguation - cancel it
      setPendingDisambiguation(null);
      setProjectSwitcherOpen(false);
    } else {
      // Normal project switching
      await setActiveProject(project?.id || null);
      setProjectSwitcherOpen(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        is_default: setAsDefault,
      });

      if (created) {
        setIsCreating(false);
        setNewProjectName('');
        setNewProjectDescription('');
        setProjectSwitcherOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!projectSwitcherOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-sm bg-zinc-900 rounded-xl shadow-2xl border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">
            {isCreating
              ? 'Neues Projekt'
              : pendingDisambiguation
                ? 'Projekt auswählen'
                : 'Projekt wechseln'}
          </h2>
          <button
            onClick={() => {
              if (pendingDisambiguation) {
                setPendingDisambiguation(null);
              }
              setProjectSwitcherOpen(false);
            }}
            className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Disambiguation hint */}
        {pendingDisambiguation && !isCreating && (
          <div className="px-4 py-2 text-xs text-violet-300 bg-violet-500/10 border-b border-white/10">
            Welches Projekt meinst du?
          </div>
        )}

        {/* Content */}
        <div className="max-h-[300px] overflow-y-auto">
          {isCreating ? (
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  Projektname *
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="z.B. VoxNote App"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newProjectName.trim()) {
                      handleCreateProject();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  Beschreibung (optional)
                </label>
                <input
                  type="text"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="z.B. Voice-to-text Desktop App"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/10 border-white/20 text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-xs text-white/70">Als Standard setzen</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                  }}
                  className="flex-1 px-3 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || isSubmitting}
                  className="flex-1 px-3 py-2 text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Erstellen...' : 'Erstellen'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {/* No project option */}
              <button
                onClick={() => handleSelectProject(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  !activeProjectId
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <FolderOpen className="w-5 h-5 opacity-50" />
                <span className="flex-1 text-left text-sm">Ohne Projekt</span>
                {!activeProjectId && <Check className="w-4 h-4" />}
              </button>

              {/* Project list */}
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Folder className="w-5 h-5" />
                  <div className="flex-1 text-left">
                    <div className="text-sm">{project.name}</div>
                    {project.description && (
                      <div className="text-xs text-white/40 truncate">
                        {project.description}
                      </div>
                    )}
                  </div>
                  {activeProjectId === project.id && (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              ))}

              {projects.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-white/40">
                  Keine Projekte vorhanden
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCreating && (
          <div className="px-2 py-2 border-t border-white/10">
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Neues Projekt erstellen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
