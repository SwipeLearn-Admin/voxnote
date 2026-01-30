import { pullArtifacts, pushArtifact, isAuthenticated, type ArtifactRow, type ArtifactData } from './supabase';
import { listHistory, appendHistoryItem, rewriteHistory, type HistoryItemWithSync } from './history';
import type { HistoryItem, ModeId } from '../shared/types';

/**
 * Extended history item with sync metadata
 */
export interface SyncableHistoryItem extends HistoryItem {
  synced?: boolean;
  syncedAt?: number;
  cloudId?: string;
}

/**
 * Convert Supabase artifact to local history format
 */
function cloudToLocal(artifact: ArtifactRow): SyncableHistoryItem {
  return {
    id: artifact.id,
    createdAt: new Date(artifact.created_at).getTime(),
    updatedAt: artifact.updated_at ? new Date(artifact.updated_at).getTime() : undefined,
    mode: artifact.mode as ModeId,
    language: (artifact.language || 'auto') as 'auto' | 'de' | 'en',
    instruction: artifact.instruction || undefined,
    title: artifact.title || artifact.transcript.slice(0, 60),
    transcript: artifact.transcript,
    result: {
      markdown: artifact.result_markdown,
      json: artifact.result_json,
    },
    provider: { stt: 'openai', llm: 'openai' },
    synced: true,
    syncedAt: Date.now(),
    cloudId: artifact.id,
  };
}

/**
 * Convert local history item to Supabase artifact format
 */
function localToCloud(item: HistoryItem): ArtifactData {
  return {
    id: item.id, // Use same ID for consistency
    mode: item.mode,
    title: item.title,
    transcript: item.transcript,
    result_markdown: item.result.markdown,
    result_json: item.result.json,
    language: item.language,
    instruction: item.instruction,
  };
}

/**
 * Pull artifacts from cloud and merge with local history
 * Strategy: Cloud wins for items with same ID
 */
export async function pullAndMerge(): Promise<{ success: boolean; merged: number; error?: string }> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { success: false, merged: 0, error: 'Not authenticated' };
  }

  try {
    // Pull from cloud
    const cloudResult = await pullArtifacts(100);
    if (!cloudResult.success || !cloudResult.artifacts) {
      return { success: false, merged: 0, error: cloudResult.error };
    }

    // Get local history
    const localItems = await listHistory(1000); // Get all local

    // Create merged map (ID -> item)
    const mergedMap = new Map<string, SyncableHistoryItem>();

    // Add local items first
    for (const item of localItems) {
      mergedMap.set(item.id, { ...item, synced: (item as SyncableHistoryItem).synced });
    }

    // Cloud items override local (or add new)
    let newFromCloud = 0;
    for (const artifact of cloudResult.artifacts) {
      const localItem = mergedMap.get(artifact.id);
      if (!localItem) {
        // New item from cloud
        mergedMap.set(artifact.id, cloudToLocal(artifact));
        newFromCloud++;
      } else {
        // Item exists - mark as synced
        mergedMap.set(artifact.id, { ...localItem, synced: true, cloudId: artifact.id });
      }
    }

    // Rewrite local history with merged data
    const mergedItems = Array.from(mergedMap.values());
    mergedItems.sort((a, b) => b.createdAt - a.createdAt); // Newest first

    await rewriteHistory(mergedItems);

    return { success: true, merged: newFromCloud };
  } catch (error) {
    console.error('Pull and merge failed:', error);
    return { success: false, merged: 0, error: String(error) };
  }
}

/**
 * Push unsynced local items to cloud
 */
export async function pushUnsynced(): Promise<{ success: boolean; pushed: number; error?: string }> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return { success: false, pushed: 0, error: 'Not authenticated' };
  }

  try {
    // Get local history
    const localItems = await listHistory(1000);

    // Find unsynced items
    const unsynced = localItems.filter((item) => !(item as SyncableHistoryItem).synced);

    let pushed = 0;
    const updatedItems: SyncableHistoryItem[] = [...localItems] as SyncableHistoryItem[];

    for (const item of unsynced) {
      const cloudData = localToCloud(item);
      const result = await pushArtifact(cloudData);

      if (result.success) {
        // Mark as synced in local
        const idx = updatedItems.findIndex((i) => i.id === item.id);
        if (idx !== -1) {
          updatedItems[idx] = {
            ...updatedItems[idx],
            synced: true,
            syncedAt: Date.now(),
            cloudId: result.id || item.id,
          };
        }
        pushed++;
      } else {
        console.error('Failed to push item:', item.id, result.error);
      }
    }

    // Update local history with sync status
    if (pushed > 0) {
      await rewriteHistory(updatedItems);
    }

    return { success: true, pushed };
  } catch (error) {
    console.error('Push unsynced failed:', error);
    return { success: false, pushed: 0, error: String(error) };
  }
}

/**
 * Full sync: pull then push
 */
export async function fullSync(): Promise<{ success: boolean; pulled: number; pushed: number; error?: string }> {
  // First pull to get latest from cloud
  const pullResult = await pullAndMerge();
  if (!pullResult.success) {
    return { success: false, pulled: 0, pushed: 0, error: pullResult.error };
  }

  // Then push any remaining unsynced
  const pushResult = await pushUnsynced();
  if (!pushResult.success) {
    return { success: false, pulled: pullResult.merged, pushed: 0, error: pushResult.error };
  }

  return {
    success: true,
    pulled: pullResult.merged,
    pushed: pushResult.pushed,
  };
}
