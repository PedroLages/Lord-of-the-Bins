import Dexie, { type Table } from 'dexie';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement, DemoUser, AppearanceSettings, WeeklyExclusions, FillGapsSettings, PlanningTemplate } from '../../types';
import type { ActivityLogEntry } from '../activityLogService';
import type { SchedulingRules } from '../schedulingService';

/**
 * App settings persisted to IndexedDB
 */
export interface AppSettings {
  id: 'app_settings'; // Single record with fixed ID
  theme: 'Modern' | 'Midnight';
  schedulingRules: SchedulingRules;
  skills?: string[]; // Custom skills (if empty, uses INITIAL_SKILLS)
  appearance?: AppearanceSettings; // Color palette and appearance settings
  fillGapsSettings?: FillGapsSettings; // Soft rules for Fill Gaps feature
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
  users!: Table<DemoUser, string>;
  weeklyExclusions!: Table<WeeklyExclusions, string>;
  planningTemplates!: Table<PlanningTemplate, string>;

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

    // Version 3 - Add users table for local auth
    this.version(3).stores({
      operators: 'id, name, type, status, archived',
      tasks: 'id, name, requiredSkill',
      schedules: 'id, [year+weekNumber], status',
      settings: 'id',
      activityLog: 'id, type, timestamp',
      taskRequirements: 'taskId',
      users: 'id, username', // Indexed by id and username for login lookup
    });

    // Version 4 - Add weekly exclusions table for leave management
    this.version(4).stores({
      operators: 'id, name, type, status, archived',
      tasks: 'id, name, requiredSkill',
      schedules: 'id, [year+weekNumber], status',
      settings: 'id',
      activityLog: 'id, type, timestamp',
      taskRequirements: 'taskId',
      users: 'id, username',
      weeklyExclusions: 'id, [year+weekNumber]', // Compound index for week lookup
    });

    // Version 5 - Add planning templates table
    this.version(5).stores({
      operators: 'id, name, type, status, archived',
      tasks: 'id, name, requiredSkill',
      schedules: 'id, [year+weekNumber], status',
      settings: 'id',
      activityLog: 'id, type, timestamp',
      taskRequirements: 'taskId',
      users: 'id, username',
      weeklyExclusions: 'id, [year+weekNumber]',
      planningTemplates: 'id, name, createdAt', // Indexed by id, name, and createdAt for sorting
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
