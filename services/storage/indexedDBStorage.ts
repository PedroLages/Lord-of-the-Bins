import type { Operator, TaskType, WeeklySchedule } from '../../types';
import type { ActivityLogEntry } from '../activityLogService';
import { db, isIndexedDBSupported, type AppSettings } from './database';
import type { StorageService, ExportData } from './storageService';
import { StorageError } from './storageService';

const MAX_ACTIVITY_LOG_ENTRIES = 100;
const EXPORT_VERSION = 1;

/**
 * IndexedDB implementation of StorageService using Dexie.js
 */
export class IndexedDBStorage implements StorageService {
  private available: boolean;

  constructor() {
    this.available = isIndexedDBSupported();
  }

  // ─────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────

  async initialize(): Promise<boolean> {
    if (!this.available) {
      throw new StorageError(
        'IndexedDB is not supported in this browser',
        'NOT_SUPPORTED'
      );
    }

    try {
      // Open the database (creates if doesn't exist)
      await db.open();

      // Check if this is first time (no operators = empty db)
      const operatorCount = await db.operators.count();
      return operatorCount === 0;
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw new StorageError(
        `Failed to initialize database: ${error}`,
        'UNKNOWN'
      );
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  // ─────────────────────────────────────────────────────────────────
  // Operators
  // ─────────────────────────────────────────────────────────────────

  async getAllOperators(): Promise<Operator[]> {
    try {
      return await db.operators.toArray();
    } catch (error) {
      throw new StorageError(`Failed to read operators: ${error}`, 'READ_ERROR');
    }
  }

  async getOperatorById(id: string): Promise<Operator | undefined> {
    try {
      return await db.operators.get(id);
    } catch (error) {
      throw new StorageError(`Failed to read operator: ${error}`, 'READ_ERROR');
    }
  }

  async saveOperator(operator: Operator): Promise<void> {
    try {
      await db.operators.put(operator);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async saveAllOperators(operators: Operator[]): Promise<void> {
    try {
      await db.transaction('rw', db.operators, async () => {
        await db.operators.clear();
        await db.operators.bulkPut(operators);
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deleteOperator(id: string): Promise<void> {
    try {
      await db.operators.delete(id);
    } catch (error) {
      throw new StorageError(`Failed to delete operator: ${error}`, 'WRITE_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Tasks
  // ─────────────────────────────────────────────────────────────────

  async getAllTasks(): Promise<TaskType[]> {
    try {
      return await db.tasks.toArray();
    } catch (error) {
      throw new StorageError(`Failed to read tasks: ${error}`, 'READ_ERROR');
    }
  }

  async getTaskById(id: string): Promise<TaskType | undefined> {
    try {
      return await db.tasks.get(id);
    } catch (error) {
      throw new StorageError(`Failed to read task: ${error}`, 'READ_ERROR');
    }
  }

  async saveTask(task: TaskType): Promise<void> {
    try {
      await db.tasks.put(task);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async saveAllTasks(tasks: TaskType[]): Promise<void> {
    try {
      await db.transaction('rw', db.tasks, async () => {
        await db.tasks.clear();
        await db.tasks.bulkPut(tasks);
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deleteTask(id: string): Promise<void> {
    try {
      await db.tasks.delete(id);
    } catch (error) {
      throw new StorageError(`Failed to delete task: ${error}`, 'WRITE_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Schedules
  // ─────────────────────────────────────────────────────────────────

  async getAllSchedules(): Promise<WeeklySchedule[]> {
    try {
      return await db.schedules.toArray();
    } catch (error) {
      throw new StorageError(`Failed to read schedules: ${error}`, 'READ_ERROR');
    }
  }

  async getScheduleById(id: string): Promise<WeeklySchedule | undefined> {
    try {
      return await db.schedules.get(id);
    } catch (error) {
      throw new StorageError(`Failed to read schedule: ${error}`, 'READ_ERROR');
    }
  }

  async getScheduleByWeek(year: number, weekNumber: number): Promise<WeeklySchedule | undefined> {
    try {
      return await db.schedules
        .where({ year, weekNumber })
        .first();
    } catch (error) {
      throw new StorageError(`Failed to read schedule by week: ${error}`, 'READ_ERROR');
    }
  }

  async saveSchedule(schedule: WeeklySchedule): Promise<void> {
    try {
      await db.schedules.put(schedule);
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async saveAllSchedules(schedules: WeeklySchedule[]): Promise<void> {
    try {
      await db.transaction('rw', db.schedules, async () => {
        await db.schedules.clear();
        await db.schedules.bulkPut(schedules);
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    try {
      await db.schedules.delete(id);
    } catch (error) {
      throw new StorageError(`Failed to delete schedule: ${error}`, 'WRITE_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings | undefined> {
    try {
      return await db.settings.get('app_settings');
    } catch (error) {
      throw new StorageError(`Failed to read settings: ${error}`, 'READ_ERROR');
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Ensure the ID is always 'app_settings'
      await db.settings.put({ ...settings, id: 'app_settings' });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Activity Log
  // ─────────────────────────────────────────────────────────────────

  async getActivityLog(limit: number = MAX_ACTIVITY_LOG_ENTRIES): Promise<ActivityLogEntry[]> {
    try {
      // Get most recent entries, sorted by timestamp descending
      return await db.activityLog
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      throw new StorageError(`Failed to read activity log: ${error}`, 'READ_ERROR');
    }
  }

  async addActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
    try {
      await db.activityLog.put(entry);

      // Trim old entries if over limit
      const count = await db.activityLog.count();
      if (count > MAX_ACTIVITY_LOG_ENTRIES) {
        const oldestEntries = await db.activityLog
          .orderBy('timestamp')
          .limit(count - MAX_ACTIVITY_LOG_ENTRIES)
          .primaryKeys();
        await db.activityLog.bulkDelete(oldestEntries);
      }
    } catch (error) {
      // Don't throw for activity log - not critical
      console.error('Failed to add activity log entry:', error);
    }
  }

  async clearActivityLog(): Promise<void> {
    try {
      await db.activityLog.clear();
    } catch (error) {
      throw new StorageError(`Failed to clear activity log: ${error}`, 'WRITE_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────

  async exportAll(): Promise<ExportData> {
    try {
      const [operators, tasks, schedules, settings, activityLog] = await Promise.all([
        this.getAllOperators(),
        this.getAllTasks(),
        this.getAllSchedules(),
        this.getSettings(),
        this.getActivityLog(),
      ]);

      return {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        operators,
        tasks,
        schedules,
        settings: settings || null,
        activityLog,
      };
    } catch (error) {
      throw new StorageError(`Failed to export data: ${error}`, 'READ_ERROR');
    }
  }

  async importAll(data: ExportData, overwrite: boolean = true): Promise<void> {
    try {
      await db.transaction('rw', [db.operators, db.tasks, db.schedules, db.settings, db.activityLog], async () => {
        if (overwrite) {
          await Promise.all([
            db.operators.clear(),
            db.tasks.clear(),
            db.schedules.clear(),
            db.settings.clear(),
            db.activityLog.clear(),
          ]);
        }

        await Promise.all([
          db.operators.bulkPut(data.operators),
          db.tasks.bulkPut(data.tasks),
          db.schedules.bulkPut(data.schedules),
          data.settings ? db.settings.put(data.settings) : Promise.resolve(),
          db.activityLog.bulkPut(data.activityLog),
        ]);
      });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await db.transaction('rw', [db.operators, db.tasks, db.schedules, db.settings, db.activityLog], async () => {
        await Promise.all([
          db.operators.clear(),
          db.tasks.clear(),
          db.schedules.clear(),
          db.settings.clear(),
          db.activityLog.clear(),
        ]);
      });
    } catch (error) {
      throw new StorageError(`Failed to clear all data: ${error}`, 'WRITE_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────

  private handleWriteError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);

    // Check for quota exceeded
    if (
      message.includes('QuotaExceededError') ||
      message.includes('quota') ||
      message.includes('storage')
    ) {
      throw new StorageError(
        'Storage quota exceeded. Please clear some data or export and clear old schedules.',
        'QUOTA_EXCEEDED'
      );
    }

    throw new StorageError(`Failed to write data: ${message}`, 'WRITE_ERROR');
  }
}

// Singleton instance
export const storage = new IndexedDBStorage();
