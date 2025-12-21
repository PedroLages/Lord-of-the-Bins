import { MOCK_OPERATORS, MOCK_TASKS, AppearanceSettings, FillGapsSettings } from '../../types';
import { DEFAULT_RULES } from '../schedulingService';
import { storage } from './index';
import { db } from './database';
import type { AppSettings } from './database';
import type { Operator, TaskType, WeeklySchedule } from '../../types';
import type { SchedulingRules } from '../schedulingService';

/**
 * Result of storage initialization
 */
export interface InitResult {
  isFirstTime: boolean;
  operators: Operator[];
  tasks: TaskType[];
  schedules: Record<string, WeeklySchedule>;
  settings: {
    theme: 'Modern' | 'Midnight';
    schedulingRules: SchedulingRules;
    skills?: string[];
    appearance?: AppearanceSettings;
    fillGapsSettings?: FillGapsSettings;
  };
}

/**
 * Default settings for new installations
 */
const DEFAULT_SETTINGS: AppSettings = {
  id: 'app_settings',
  theme: 'Modern',
  schedulingRules: DEFAULT_RULES,
};

/**
 * Initialize storage and load all data.
 * Seeds default data if this is the first time.
 *
 * @returns All loaded data ready for use in App state
 */
export async function initializeStorage(): Promise<InitResult> {
  // Initialize database
  const isFirstTime = await storage.initialize();

  // Seed data for IndexedDB
  if (isFirstTime) {
    console.log('First time setup - seeding default data...');
    await seedDefaultData();
  } else {
    // Run migrations for existing installations (IndexedDB only)
    await runMigrations();
  }

  // Load all data
  const [operators, tasks, allSchedules, settings] = await Promise.all([
    storage.getAllOperators(),
    storage.getAllTasks(),
    storage.getAllSchedules(),
    storage.getSettings(),
  ]);

  // Convert schedules array to record keyed by id
  const schedules: Record<string, WeeklySchedule> = {};
  allSchedules.forEach((schedule) => {
    schedules[schedule.id] = schedule;
  });

  // Use loaded settings or defaults
  const loadedSettings = settings || DEFAULT_SETTINGS;

  return {
    isFirstTime,
    operators,
    tasks,
    schedules,
    settings: {
      theme: loadedSettings.theme,
      schedulingRules: loadedSettings.schedulingRules,
      skills: loadedSettings.skills,
    },
  };
}

/**
 * Seed the database with default data.
 * Called automatically on first launch.
 */
export async function seedDefaultData(): Promise<void> {
  await Promise.all([
    storage.saveAllOperators(MOCK_OPERATORS),
    storage.saveAllTasks(MOCK_TASKS),
    storage.saveSettings(DEFAULT_SETTINGS),
  ]);

  console.log('Default data seeded successfully:', {
    operators: MOCK_OPERATORS.length,
    tasks: MOCK_TASKS.length,
  });
}

/**
 * Run data migrations for existing installations.
 * Migrations are idempotent and safe to run multiple times.
 */
async function runMigrations(): Promise<void> {
  try {
    // Migration: Remove Process/AD task (t14) - no longer used
    await migrateRemoveProcessAD();
    // Migration: Give all regular operators all skills
    await migrateAddAllSkillsToOperators();
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw - migrations are best-effort
  }
}

/**
 * Migration: Remove Process/AD task and clean up schedule assignments
 * Process/AD was removed in favor of just "Off process" with "Off Process" skill
 */
async function migrateRemoveProcessAD(): Promise<void> {
  const PROCESS_AD_TASK_ID = 't14';

  // Check if the task exists
  const task = await db.tasks.get(PROCESS_AD_TASK_ID);
  if (!task) {
    // Already migrated or never existed
    return;
  }

  console.log('Running migration: Remove Process/AD task');

  // Delete the task
  await db.tasks.delete(PROCESS_AD_TASK_ID);

  // Clean up any schedule assignments that reference this task
  const allSchedules = await db.schedules.toArray();
  let updatedCount = 0;

  for (const schedule of allSchedules) {
    let scheduleUpdated = false;

    for (const day of schedule.days) {
      for (const [opId, assignment] of Object.entries(day.assignments)) {
        if (assignment.taskId === PROCESS_AD_TASK_ID) {
          // Clear the assignment
          day.assignments[opId] = {
            taskId: null,
            locked: false,
            pinned: false,
          };
          scheduleUpdated = true;
        }
      }
    }

    if (scheduleUpdated) {
      await db.schedules.put(schedule);
      updatedCount++;
    }
  }

  console.log(`Migration complete: Removed Process/AD task, updated ${updatedCount} schedules`);
}

/**
 * Migration: Give all regular operators all available skills
 * This provides maximum scheduling flexibility
 */
async function migrateAddAllSkillsToOperators(): Promise<void> {
  // All skills available to regular operators
  const ALL_REGULAR_SKILLS = [
    'Troubleshooter',
    'Quality Checker',
    'MONO Counter',
    'Filler',
    'LVB Sheet',
    'Decanting',
    'Platform',
    'EST',
    'Exceptions',
    'Troubleshooter AD'
  ];

  // Get all operators
  const allOperators = await db.operators.toArray();
  let updatedCount = 0;

  for (const operator of allOperators) {
    // Only update Regular operators (not Flex or Coordinators)
    if (operator.type === 'Regular') {
      // Check if they already have all skills (idempotent check)
      const hasAllSkills = ALL_REGULAR_SKILLS.every(skill =>
        operator.skills.includes(skill)
      );

      if (!hasAllSkills) {
        // Update to have all skills
        operator.skills = ALL_REGULAR_SKILLS;
        await db.operators.put(operator);
        updatedCount++;
      }
    }
  }

  console.log(`Migration complete: Updated ${updatedCount} regular operators with all skills`);
}

/**
 * Migrate existing localStorage activity log to IndexedDB.
 * Call this once during migration to preserve existing logs.
 */
export async function migrateActivityLogFromLocalStorage(): Promise<number> {
  const STORAGE_KEY = 'lotb_activity_log';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;

    const entries = JSON.parse(stored);
    if (!Array.isArray(entries) || entries.length === 0) return 0;

    // Add all entries to IndexedDB
    for (const entry of entries) {
      await storage.addActivityLogEntry({
        ...entry,
        timestamp: new Date(entry.timestamp),
      });
    }

    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);

    console.log(`Migrated ${entries.length} activity log entries from localStorage`);
    return entries.length;
  } catch (error) {
    console.error('Failed to migrate activity log:', error);
    return 0;
  }
}
