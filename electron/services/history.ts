import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { HistoryItem, TaskStatus, PlanData, PlanMilestone } from '../shared/types';

const getHistoryFilePath = (): string => {
  return path.join(app.getPath('userData'), 'history.jsonl');
};

function ensureHistoryFile(): void {
  const filePath = getHistoryFilePath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
  }
}

function generateTitle(transcript: string): string {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) {
    return cleaned;
  }
  return cleaned.slice(0, 60) + '...';
}

export function appendHistoryItem(item: HistoryItem): void {
  ensureHistoryFile();
  const filePath = getHistoryFilePath();

  // Ensure title is set
  const itemWithTitle = {
    ...item,
    title: item.title || generateTitle(item.transcript),
  };

  const line = JSON.stringify(itemWithTitle) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

export function listHistory(limit: number = 30): HistoryItem[] {
  ensureHistoryFile();
  const filePath = getHistoryFilePath();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const items: HistoryItem[] = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as HistoryItem;
        // Ensure title exists for backwards compatibility
        if (!item.title) {
          item.title = generateTitle(item.transcript);
        }
        items.push(item);
      } catch {
        // Skip invalid lines
      }
    }

    // Return most recent first
    return items.reverse().slice(0, limit);
  } catch {
    return [];
  }
}

export function getHistoryItem(id: string): HistoryItem | null {
  const items = listHistory(1000); // Load all for search
  const item = items.find((item) => item.id === id) || null;

  if (item && !item.title) {
    item.title = generateTitle(item.transcript);
  }

  return item;
}

export function deleteHistoryItem(id: string): void {
  ensureHistoryFile();
  const filePath = getHistoryFilePath();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const filteredLines: string[] = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as HistoryItem;
        if (item.id !== id) {
          filteredLines.push(line);
        }
      } catch {
        // Discard invalid lines
      }
    }

    fs.writeFileSync(filePath, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''), 'utf-8');
  } catch {
    // Ignore errors
  }
}

export function clearHistory(): void {
  const filePath = getHistoryFilePath();
  try {
    fs.writeFileSync(filePath, '', 'utf-8');
  } catch {
    // Ignore errors
  }
}

/**
 * Extended history item type with sync metadata
 */
export interface HistoryItemWithSync extends HistoryItem {
  synced?: boolean;
  syncedAt?: number;
  cloudId?: string;
}

/**
 * Rewrite entire history file with new items (used for sync)
 */
export async function rewriteHistory(items: HistoryItemWithSync[]): Promise<void> {
  ensureHistoryFile();
  const filePath = getHistoryFilePath();

  // Sort by createdAt descending (newest first) then reverse for file order (oldest first in file)
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);

  const lines = sorted.map((item) => {
    // Ensure title
    const itemWithTitle = {
      ...item,
      title: item.title || generateTitle(item.transcript),
    };
    return JSON.stringify(itemWithTitle);
  });

  fs.writeFileSync(filePath, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf-8');
}

/**
 * Update task status in a plan artifact
 */
export function updatePlanTaskStatus(
  historyItemId: string,
  taskId: string,
  status: TaskStatus
): { success: boolean; error?: string; updatedItem?: HistoryItem } {
  ensureHistoryFile();
  const filePath = getHistoryFilePath();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const updatedLines: string[] = [];
    let found = false;
    let updatedItem: HistoryItem | undefined;

    for (const line of lines) {
      try {
        const item = JSON.parse(line) as HistoryItem;

        if (item.id === historyItemId) {
          found = true;

          // Check if this is a plan mode item with data
          if (item.mode !== 'plan' || !item.result?.json) {
            return { success: false, error: 'Item is not a plan artifact' };
          }

          const planData = item.result.json as PlanData;
          let taskFound = false;

          // Find and update the task
          for (const milestone of planData.milestones) {
            for (const task of milestone.tasks) {
              if (task.id === taskId) {
                task.status = status;
                taskFound = true;
                break;
              }
            }
            if (taskFound) break;
          }

          if (!taskFound) {
            return { success: false, error: `Task ${taskId} not found` };
          }

          // Update the item
          item.result.json = planData;
          item.updatedAt = Date.now();
          updatedItem = item;

          updatedLines.push(JSON.stringify(item));
        } else {
          updatedLines.push(line);
        }
      } catch {
        updatedLines.push(line); // Keep invalid lines as-is
      }
    }

    if (!found) {
      return { success: false, error: `History item ${historyItemId} not found` };
    }

    fs.writeFileSync(filePath, updatedLines.join('\n') + '\n', 'utf-8');

    return { success: true, updatedItem };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
