import type { Operator, TaskType, WeeklySchedule } from '../../types';
import type { ActivityLogEntry } from '../activityLogService';
import type { AppSettings } from './database';

/**
 * Abstract storage service interface.
 *
 * This interface allows swapping storage backends (IndexedDB → Supabase)
 * without changing the rest of the application.
 */
export interface StorageService {
  // ─────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────

  /**
   * Initialize the storage backend.
   * Returns true if this is first time (empty database).
   */
  initialize(): Promise<boolean>;

  /**
   * Check if storage is available and working
   */
  isAvailable(): boolean;

  // ─────────────────────────────────────────────────────────────────
  // Operators
  // ─────────────────────────────────────────────────────────────────

  getAllOperators(): Promise<Operator[]>;
  getOperatorById(id: string): Promise<Operator | undefined>;
  saveOperator(operator: Operator): Promise<void>;
  saveAllOperators(operators: Operator[]): Promise<void>;
  deleteOperator(id: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Tasks
  // ─────────────────────────────────────────────────────────────────

  getAllTasks(): Promise<TaskType[]>;
  getTaskById(id: string): Promise<TaskType | undefined>;
  saveTask(task: TaskType): Promise<void>;
  saveAllTasks(tasks: TaskType[]): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Schedules
  // ─────────────────────────────────────────────────────────────────

  getAllSchedules(): Promise<WeeklySchedule[]>;
  getScheduleById(id: string): Promise<WeeklySchedule | undefined>;
  getScheduleByWeek(year: number, weekNumber: number): Promise<WeeklySchedule | undefined>;
  saveSchedule(schedule: WeeklySchedule): Promise<void>;
  saveAllSchedules(schedules: WeeklySchedule[]): Promise<void>;
  deleteSchedule(id: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────

  getSettings(): Promise<AppSettings | undefined>;
  saveSettings(settings: AppSettings): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Activity Log
  // ─────────────────────────────────────────────────────────────────

  getActivityLog(limit?: number): Promise<ActivityLogEntry[]>;
  addActivityLogEntry(entry: ActivityLogEntry): Promise<void>;
  clearActivityLog(): Promise<void>;

  // ─────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────

  /**
   * Export all data as JSON (for backup)
   */
  exportAll(): Promise<ExportData>;

  /**
   * Import data from JSON (restore backup)
   * @param data - The exported data
   * @param overwrite - If true, clears existing data first
   */
  importAll(data: ExportData, overwrite?: boolean): Promise<void>;

  /**
   * Clear all data from storage
   */
  clearAll(): Promise<void>;
}

/**
 * Data structure for export/import
 */
export interface ExportData {
  version: number;
  exportedAt: string;
  operators: Operator[];
  tasks: TaskType[];
  schedules: WeeklySchedule[];
  settings: AppSettings | null;
  activityLog: ActivityLogEntry[];
}

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_SUPPORTED' | 'QUOTA_EXCEEDED' | 'READ_ERROR' | 'WRITE_ERROR' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
