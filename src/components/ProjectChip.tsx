'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Folder, ChevronDown } from 'lucide-react';

export function ProjectChip() {
  const {
    activeProjectId,
    projects,
    projectsLoading,
    setProjectSwitcherOpen,
    loadProjects,
  } = useAppStore();

  const loadAttemptedRef = useRef(false);

  // Load projects once on mount
  useEffect(() => {
    if (!loadAttemptedRef.current && projects.length === 0 && !projectsLoading) {
      loadAttemptedRef.current = true;
      loadProjects().catch(() => {
        // Silently handle - label will show "Kein Projekt"
      });
    }
  }, [projects.length, projectsLoading, loadProjects]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleClick = () => {
    setProjectSwitcherOpen(true);
  };

  // Compute label - don't block UI on loading
  const getLabel = (): string => {
    // Have active project
    if (activeProject) return activeProject.name;
    // Still loading (but only briefly show this)
    if (projectsLoading && !loadAttemptedRef.current) return 'Laden...';
    // No project selected - this is the default state
    return 'Kein Projekt';
  };

  const label = getLabel();

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted hover:text-text-primary bg-surface hover:bg-surface-hover rounded-md transition-colors group"
      title={activeProject ? `Aktives Projekt: ${activeProject.name}` : 'Projekt auswählen'}
    >
      <Folder className="w-3.5 h-3.5" />
      <span className="max-w-[120px] truncate">{label}</span>
      <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" />
    </button>
  );
}
