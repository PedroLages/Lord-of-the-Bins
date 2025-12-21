/**
 * Sync Queue Service - Lord of the Bins
 *
 * Handles background synchronization of local changes to Supabase.
 * Changes are queued in IndexedDB and processed asynchronously.
 */

import Dexie from 'dexie';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/client';

// Allowed table names for sync operations (security whitelist)
const ALLOWED_TABLES = [
  'operators',
  'tasks',
  'schedules',
  'task_requirements',
  'scheduling_rules',
  'app_settings',
  'activity_log'
] as const;

type AllowedTable = typeof ALLOWED_TABLES[number];

/**
 * Validate that the table name is in the allowed whitelist
 */
function validateTableName(table: string): asserts table is AllowedTable {
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
    throw new Error(`Invalid table name for sync: ${table}. Allowed tables: ${ALLOWED_TABLES.join(', ')}`);
  }
}

// Sync queue item structure
export interface SyncQueueItem {
  id?: number; // Auto-incremented by Dexie
  table: string;
  operation: 'insert' | 'update' | 'delete';
  localId: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// Sync status for UI
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

// Create a Dexie database for the sync queue
class SyncQueueDB extends Dexie {
  queue!: Dexie.Table<SyncQueueItem, number>;

  constructor() {
    super('LotB_SyncQueue');
    this.version(1).stores({
      queue: '++id, table, localId, timestamp',
    });
  }
}

const syncQueueDB = new SyncQueueDB();

// Sync state management
let syncState: SyncState = {
  status: 'idle',
  pendingCount: 0,
  lastSyncAt: null,
  error: null,
};

const listeners: Set<(state: SyncState) => void> = new Set();

function updateSyncState(updates: Partial<SyncState>) {
  syncState = { ...syncState, ...updates };
  listeners.forEach((listener) => listener(syncState));
}

/**
 * Subscribe to sync state changes
 */
export function subscribeSyncState(callback: (state: SyncState) => void): () => void {
  listeners.add(callback);
  callback(syncState); // Initial call
  return () => listeners.delete(callback);
}

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return syncState;
}

/**
 * Add an item to the sync queue
 */
export async function queueSync(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  localId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured) {
    // No Supabase, no need to queue
    return;
  }

  // Check if there's already a pending item for this record
  const existing = await syncQueueDB.queue
    .where({ table, localId })
    .first();

  if (existing) {
    // Update existing queue item
    await syncQueueDB.queue.update(existing.id!, {
      operation,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      lastError: undefined,
    });
  } else {
    // Add new queue item
    await syncQueueDB.queue.add({
      table,
      operation,
      localId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  // Update pending count
  const count = await syncQueueDB.queue.count();
  updateSyncState({ pendingCount: count });

  // Trigger sync
  processSyncQueue();
}

// Sync processing state
let isProcessing = false;
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Process the sync queue
 */
async function processSyncQueue(): Promise<void> {
  if (isProcessing) return;
  if (!isSupabaseConfigured) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Check if we're online
  if (!navigator.onLine) {
    updateSyncState({ status: 'offline' });
    return;
  }

  isProcessing = true;
  updateSyncState({ status: 'syncing' });

  try {
    // Get all pending items, ordered by timestamp
    const items = await syncQueueDB.queue.orderBy('timestamp').toArray();

    if (items.length === 0) {
      updateSyncState({
        status: 'idle',
        pendingCount: 0,
        lastSyncAt: new Date(),
        error: null,
      });
      isProcessing = false;
      return;
    }

    // Process each item
    for (const item of items) {
      try {
        await processQueueItem(supabase, item);

        // Remove from queue on success
        await syncQueueDB.queue.delete(item.id!);
      } catch (error) {
        // Increment retry count
        const newRetryCount = item.retryCount + 1;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (newRetryCount >= 5) {
          // Max retries reached, log and remove
          console.error(`[Sync] Max retries reached for ${item.table}/${item.localId}:`, errorMessage);
          await syncQueueDB.queue.delete(item.id!);
        } else {
          // Update retry count
          await syncQueueDB.queue.update(item.id!, {
            retryCount: newRetryCount,
            lastError: errorMessage,
          });
        }
      }
    }

    // Update final state
    const remainingCount = await syncQueueDB.queue.count();
    updateSyncState({
      status: remainingCount > 0 ? 'error' : 'idle',
      pendingCount: remainingCount,
      lastSyncAt: new Date(),
      error: remainingCount > 0 ? 'Some items failed to sync' : null,
    });
  } catch (error) {
    console.error('[Sync] Queue processing error:', error);
    updateSyncState({
      status: 'error',
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  } finally {
    isProcessing = false;
  }
}

/**
 * Process a single queue item
 */
async function processQueueItem(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  item: SyncQueueItem
): Promise<void> {
  const { table, operation, data } = item;

  // Validate table name against whitelist
  validateTableName(table);

  switch (operation) {
    case 'insert': {
      const { error } = await (supabase as any).from(table).insert(data);
      if (error) throw new Error(error.message);
      break;
    }
    case 'update': {
      const { error } = await (supabase as any)
        .from(table)
        .update(data)
        .eq('local_id', item.localId);
      if (error) throw new Error(error.message);
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('local_id', item.localId);
      if (error) throw new Error(error.message);
      break;
    }
  }
}

/**
 * Retry failed sync items
 */
export async function retrySyncQueue(): Promise<void> {
  // Reset retry counts
  await syncQueueDB.queue.toCollection().modify({ retryCount: 0, lastError: undefined });
  processSyncQueue();
}

/**
 * Clear the sync queue (careful - loses unsynced changes!)
 */
export async function clearSyncQueue(): Promise<void> {
  await syncQueueDB.queue.clear();
  updateSyncState({
    status: 'idle',
    pendingCount: 0,
    error: null,
  });
}

/**
 * Get all pending sync items (for debugging)
 */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return syncQueueDB.queue.toArray();
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online, processing queue');
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[Sync] Went offline');
    updateSyncState({ status: 'offline' });
  });

  // Initial sync on load
  if (isSupabaseConfigured && navigator.onLine) {
    setTimeout(processSyncQueue, 1000);
  }
}

// Periodic sync (every 30 seconds if there are pending items)
setInterval(() => {
  if (syncState.pendingCount > 0 && navigator.onLine) {
    processSyncQueue();
  }
}, 30000);
