import Dexie, { type Table } from 'dexie';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement } from '../../types';
import type { ActivityLogEntry } from '../activityLogService';
import type { SchedulingRules } from '../schedulingService';

/**
 * App settings persisted to IndexedDB
 */
export interface AppSettings {
  id: 'app_settings'; // Single record with fixed ID
  theme: 'Modern' | 'Midnight';
  schedulingRules: SchedulingRules;
}

/**
 * Lord of the Bins IndexedDB Database
 *
 * Uses Dexie.js for cleaner API over raw IndexedDB.
 * Schema designed for easy migration to Supabase later.
 */
export class LotBDatabase extends Dexie {
  operators!: Table<Operator, string>;
  tasks!: Table<TaskType, string>;
  schedules!: Table<WeeklySchedule, string>;
  settings!: Table<AppSettings, string>;
  activityLog!: Table<ActivityLogEntry, string>;
  taskRequirements!: Table<TaskRequirement, string>;

  constructor() {
    super('LordOfTheBinsDB');

    // Version 1 - Initial schema
    this.version(1).stores({
      // Primary key is 'id' for all tables
      // Indexed fields after the primary key for querying
      operators: 'id, name, type, status, archived',
      tasks: 'id, name, requiredSkill',
      schedules: 'id, [year+weekNumber], status', // Compound index for week lookup
      settings: 'id',
      activityLog: 'id, type, timestamp',
    });

    // Version 2 - Add task requirements table
    this.version(2).stores({
      operators: 'id, name, type, status, archived',
      tasks: 'id, name, requiredSkill',
      schedules: 'id, [year+weekNumber], status',
      settings: 'id',
      activityLog: 'id, type, timestamp',
      taskRequirements: 'taskId', // Primary key is taskId (one requirement per task)
    });
  }
}

// Singleton instance
export const db = new LotBDatabase();

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Get database storage estimate (if available)
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return null;
}
