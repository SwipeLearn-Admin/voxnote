'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderKanban,
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  Circle,
  Clock,
  AlertCircle,
  Target,
  Trash2,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import * as ipc from '@/lib/ipc';
import clsx from 'clsx';
import type { Project, HistoryItem, PlanData, TaskStatus } from '../../electron/shared/types';

interface ProjectWithPlan extends Project {
  plan?: {
    historyItemId: string;
    data: PlanData;
  };
}

// Status icon component
function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'done':
      return <Check className="w-3.5 h-3.5 text-green-400" />;
    case 'in_progress':
      return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
    case 'blocked':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-white/30" />;
  }
}

export function ProjectsPanel() {
  const {
    projectsPanelOpen,
    setProjectsPanelOpen,
    projects,
    activeProjectId,
    setActiveProject,
    historyItems,
    loadProjects,
    loadHistoryList,
  } = useAppStore();

  // Derive currentProject from activeProjectId
  const currentProject = projects.find((p) => p.id === activeProjectId) || null;

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

  // Load data on mount
  useEffect(() => {
    if (projectsPanelOpen) {
      loadProjects();
      loadHistoryList();
    }
  }, [projectsPanelOpen, loadProjects, loadHistoryList]);

  // Get all plan items sorted by creation date (newest first)
  const allPlanItems = historyItems
    .filter((item) => item.mode === 'plan' && item.result?.json)
    .sort((a, b) => b.createdAt - a.createdAt);

  // Build projects with their plans
  const projectsWithPlans: ProjectWithPlan[] = projects.map((project) => {
    // Find the most recent plan that mentions this project name
    const matchingPlan = allPlanItems.find((item) => {
      const planData = item.result?.json as PlanData | undefined;
      const planName = planData?.projectName?.toLowerCase() || '';
      const projectName = project.name.toLowerCase();
      return planName.includes(projectName) || projectName.includes(planName);
    });

    return {
      ...project,
      plan: matchingPlan
        ? {
            historyItemId: matchingPlan.id,
            data: matchingPlan.result?.json as PlanData,
          }
        : undefined,
    };
  });

  // Get orphan plans (plans not linked to any project) - deduplicated by project name
  // Only keep the most recent plan for each unique project name
  const usedPlanIds = new Set(projectsWithPlans.filter(p => p.plan).map(p => p.plan!.historyItemId));
  const seenProjectNames = new Set<string>();

  const orphanPlans = allPlanItems.filter((item) => {
    if (usedPlanIds.has(item.id)) return false;

    const planData = item.result?.json as PlanData | undefined;
    const projectName = planData?.projectName?.toLowerCase().trim() || '';
    if (!projectName) return false;

    // Normalize the name to catch similar names
    const normalizedName = projectName
      .replace(/[-_\s]+/g, ' ')
      .replace(/\s*(app|application|projekt|project)\s*/gi, '')
      .trim();

    // Skip if we've already seen a similar project name
    if (seenProjectNames.has(normalizedName)) return false;

    seenProjectNames.add(normalizedName);
    return true;
  });

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleMilestone = (milestoneKey: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneKey)) {
        next.delete(milestoneKey);
      } else {
        next.add(milestoneKey);
      }
      return next;
    });
  };

  const handleTaskStatusChange = async (
    historyItemId: string,
    taskId: string,
    currentStatus: TaskStatus
  ) => {
    // Cycle through statuses: todo -> in_progress -> done -> todo
    const nextStatus: TaskStatus =
      currentStatus === 'todo'
        ? 'in_progress'
        : currentStatus === 'in_progress'
        ? 'done'
        : 'todo';

    await ipc.updatePlanTaskStatus(historyItemId, taskId, nextStatus);
    // Reload to get updated data
    loadHistoryList();
  };

  const selectProject = (project: Project) => {
    setActiveProject(project.id);
  };

  const getProjectProgress = (plan: PlanData | undefined) => {
    if (!plan?.milestones) return { done: 0, total: 0 };

    let done = 0;
    let total = 0;

    for (const milestone of plan.milestones) {
      for (const task of milestone.tasks || []) {
        total++;
        if (task.status === 'done') done++;
      }
    }

    return { done, total };
  };

  if (!projectsPanelOpen) {
    return null;
  }

  return (
    <div className="relative z-10 h-full w-[360px] shrink-0 bg-bg-secondary/95 backdrop-blur-xl border-l border-border flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-text-primary">Projekte</h2>
        </div>
        <span className="text-xs text-muted">{projects.length} Projekte</span>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {projectsWithPlans.length === 0 && orphanPlans.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-muted p-4"
            >
              <FolderKanban className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm text-center">Noch keine Projekte</p>
              <p className="text-xs text-center mt-1 text-white/40">
                Sage &quot;Erstelle einen Plan für...&quot;
              </p>
            </motion.div>
          ) : (
            <div className="py-2">
              {/* Projects with plans */}
              {projectsWithPlans.map((project) => {
                const isExpanded = expandedProjects.has(project.id);
                const isSelected = currentProject?.id === project.id;
                const progress = getProjectProgress(project.plan?.data);

                return (
                  <div key={project.id} className="mb-1">
                    {/* Project Header */}
                    <div
                      className={clsx(
                        'mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-purple-500/20 border border-purple-500/30'
                          : 'hover:bg-surface-hover'
                      )}
                      onClick={() => selectProject(project)}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProject(project.id);
                          }}
                          className="p-0.5 hover:bg-surface-hover rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-white/50" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/50" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {project.name}
                            </span>
                            {project.is_default && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                                Aktiv
                              </span>
                            )}
                          </div>
                          {project.plan && progress.total > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full transition-all"
                                  style={{
                                    width: `${(progress.done / progress.total) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted">
                                {progress.done}/{progress.total}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded: Milestones & Tasks */}
                    <AnimatePresence>
                      {isExpanded && project.plan && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-6 mr-2 mt-1 space-y-1">
                            {project.plan.data.milestones?.map((milestone) => {
                              const milestoneKey = `${project.id}-${milestone.id}`;
                              const isMilestoneExpanded = expandedMilestones.has(milestoneKey);
                              const milestoneTasks = milestone.tasks || [];
                              const doneTasks = milestoneTasks.filter(
                                (t) => t.status === 'done'
                              ).length;

                              return (
                                <div key={milestone.id}>
                                  {/* Milestone Header */}
                                  <div
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer"
                                    onClick={() => toggleMilestone(milestoneKey)}
                                  >
                                    {milestoneTasks.length > 0 ? (
                                      isMilestoneExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                                      )
                                    ) : (
                                      <Target className="w-3.5 h-3.5 text-white/40" />
                                    )}
                                    <span className="flex-1 text-xs text-text-secondary truncate">
                                      {milestone.name}
                                    </span>
                                    {milestoneTasks.length > 0 && (
                                      <span className="text-[10px] text-muted">
                                        {doneTasks}/{milestoneTasks.length}
                                      </span>
                                    )}
                                  </div>

                                  {/* Tasks */}
                                  <AnimatePresence>
                                    {isMilestoneExpanded && milestoneTasks.length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="ml-4 space-y-0.5"
                                      >
                                        {milestoneTasks.map((task) => (
                                          <div
                                            key={task.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-hover group"
                                          >
                                            <button
                                              onClick={() =>
                                                handleTaskStatusChange(
                                                  project.plan!.historyItemId,
                                                  task.id,
                                                  task.status
                                                )
                                              }
                                              className="shrink-0"
                                            >
                                              <StatusIcon status={task.status} />
                                            </button>
                                            <span
                                              className={clsx(
                                                'flex-1 text-xs truncate',
                                                task.status === 'done'
                                                  ? 'text-white/40 line-through'
                                                  : 'text-text-secondary'
                                              )}
                                            >
                                              {task.title}
                                            </span>
                                            <span
                                              className={clsx(
                                                'text-[10px] px-1 rounded',
                                                task.estimate === 'XS' || task.estimate === 'S'
                                                  ? 'bg-green-500/20 text-green-400'
                                                  : task.estimate === 'M'
                                                  ? 'bg-yellow-500/20 text-yellow-400'
                                                  : 'bg-red-500/20 text-red-400'
                                              )}
                                            >
                                              {task.estimate}
                                            </span>
                                          </div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Orphan Plans (plans without matching projects) */}
              {orphanPlans.map((item) => {
                const planData = item.result?.json as PlanData;
                const projectKey = `orphan-${item.id}`;
                const isExpanded = expandedProjects.has(projectKey);
                const progress = getProjectProgress(planData);

                return (
                  <div key={item.id} className="mb-1">
                    {/* Plan Header */}
                    <div
                      className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-hover transition-colors"
                      onClick={() => toggleProject(projectKey)}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProject(projectKey);
                          }}
                          className="p-0.5 hover:bg-surface-hover rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-white/50" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-white/50" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary truncate">
                              {planData.projectName || 'Unbenannter Plan'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                              Plan
                            </span>
                          </div>
                          {progress.total > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full transition-all"
                                  style={{
                                    width: `${(progress.done / progress.total) * 100}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-muted">
                                {progress.done}/{progress.total}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded: Milestones & Tasks */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-6 mr-2 mt-1 space-y-1">
                            {planData.milestones?.map((milestone) => {
                              const milestoneKey = `${projectKey}-${milestone.id}`;
                              const isMilestoneExpanded = expandedMilestones.has(milestoneKey);
                              const milestoneTasks = milestone.tasks || [];
                              const doneTasks = milestoneTasks.filter(
                                (t) => t.status === 'done'
                              ).length;

                              return (
                                <div key={milestone.id}>
                                  {/* Milestone Header */}
                                  <div
                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-hover cursor-pointer"
                                    onClick={() => toggleMilestone(milestoneKey)}
                                  >
                                    {milestoneTasks.length > 0 ? (
                                      isMilestoneExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                                      )
                                    ) : (
                                      <Target className="w-3.5 h-3.5 text-white/40" />
                                    )}
                                    <span className="flex-1 text-xs text-text-secondary truncate">
                                      {milestone.name}
                                    </span>
                                    {milestoneTasks.length > 0 && (
                                      <span className="text-[10px] text-muted">
                                        {doneTasks}/{milestoneTasks.length}
                                      </span>
                                    )}
                                  </div>

                                  {/* Tasks */}
                                  <AnimatePresence>
                                    {isMilestoneExpanded && milestoneTasks.length > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="ml-4 space-y-0.5"
                                      >
                                        {milestoneTasks.map((task) => (
                                          <div
                                            key={task.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-hover group"
                                          >
                                            <button
                                              onClick={() =>
                                                handleTaskStatusChange(item.id, task.id, task.status)
                                              }
                                              className="shrink-0"
                                            >
                                              <StatusIcon status={task.status} />
                                            </button>
                                            <span
                                              className={clsx(
                                                'flex-1 text-xs truncate',
                                                task.status === 'done'
                                                  ? 'text-white/40 line-through'
                                                  : 'text-text-secondary'
                                              )}
                                            >
                                              {task.title}
                                            </span>
                                            <span
                                              className={clsx(
                                                'text-[10px] px-1 rounded',
                                                task.estimate === 'XS' || task.estimate === 'S'
                                                  ? 'bg-green-500/20 text-green-400'
                                                  : task.estimate === 'M'
                                                  ? 'bg-yellow-500/20 text-yellow-400'
                                                  : 'bg-red-500/20 text-red-400'
                                              )}
                                            >
                                              {task.estimate}
                                            </span>
                                          </div>
                                        ))}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-border shrink-0">
        <button
          onClick={() => setProjectsPanelOpen(false)}
          className="w-full px-3 py-2 glass glass-hover text-muted hover:text-text-primary text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
        >
          Schliessen
        </button>
      </div>
    </div>
  );
}
