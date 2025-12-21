/**
 * Data Export/Import Service - Lord of the Bins
 *
 * Provides utilities for:
 * - Exporting all local data to JSON
 * - Importing data from JSON
 * - Migrating data to Supabase
 */

import { storage } from '../storage/index';
import { supabaseStorage } from '../supabase/supabaseStorage';
import { isSupabaseConfigured } from '../supabase/client';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement } from '../../types';
import type { SchedulingRules } from '../schedulingService';
import type { AppSettings } from '../storage/database';

// Export data structure
export interface ExportedData {
  version: string;
  exportedAt: string;
  source: 'indexeddb' | 'supabase';
  data: {
    operators: Operator[];
    tasks: TaskType[];
    schedules: WeeklySchedule[];
    taskRequirements: TaskRequirement[];
    settings: AppSettings | null;
  };
}

// Export version (for future migrations)
const EXPORT_VERSION = '2.0';

/**
 * Export all local data to JSON
 */
export async function exportLocalData(): Promise<ExportedData> {
  const [operators, tasks, schedules, taskRequirements, settings] = await Promise.all([
    storage.getAllOperators(),
    storage.getAllTasks(),
    storage.getAllSchedules(),
    storage.getAllTaskRequirements(),
    storage.getSettings(),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: 'indexeddb',
    data: {
      operators,
      tasks,
      schedules,
      taskRequirements,
      settings,
    },
  };
}

/**
 * Download exported data as JSON file
 */
export function downloadExportAsJSON(data: ExportedData, filename?: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `lotb-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Read and parse an uploaded JSON file
 */
export function readUploadedFile(file: File): Promise<ExportedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportedData;

        // Validate structure
        if (!data.version || !data.data) {
          throw new Error('Invalid export file format');
        }

        resolve(data);
      } catch (error) {
        reject(new Error('Failed to parse export file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Import data to local IndexedDB
 */
export async function importToLocal(data: ExportedData): Promise<{
  imported: { operators: number; tasks: number; schedules: number; taskRequirements: number };
  errors: string[];
}> {
  const errors: string[] = [];
  const imported = { operators: 0, tasks: 0, schedules: 0, taskRequirements: 0 };

  // Import operators
  for (const operator of data.data.operators) {
    try {
      await storage.saveOperator(operator);
      imported.operators++;
    } catch (error) {
      errors.push(`Operator ${operator.name}: ${(error as Error).message}`);
    }
  }

  // Import tasks
  for (const task of data.data.tasks) {
    try {
      await storage.saveTask(task);
      imported.tasks++;
    } catch (error) {
      errors.push(`Task ${task.name}: ${(error as Error).message}`);
    }
  }

  // Import schedules
  for (const schedule of data.data.schedules) {
    try {
      await storage.saveSchedule(schedule);
      imported.schedules++;
    } catch (error) {
      errors.push(`Schedule ${schedule.weekLabel}: ${(error as Error).message}`);
    }
  }

  // Import task requirements
  for (const req of data.data.taskRequirements) {
    try {
      await storage.saveTaskRequirement(req);
      imported.taskRequirements++;
    } catch (error) {
      errors.push(`Task requirement ${req.taskId}: ${(error as Error).message}`);
    }
  }

  // Import settings
  if (data.data.settings) {
    try {
      await storage.saveSettings(data.data.settings);
    } catch (error) {
      errors.push(`Settings: ${(error as Error).message}`);
    }
  }

  return { imported, errors };
}

/**
 * Push local data to Supabase
 */
export async function pushToCloud(shiftId: string): Promise<{
  pushed: { operators: number; tasks: number; schedules: number; taskRequirements: number };
  errors: string[];
}> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }

  supabaseStorage.setShiftId(shiftId);

  const errors: string[] = [];
  const pushed = { operators: 0, tasks: 0, schedules: 0, taskRequirements: 0 };

  // Get all local data
  const [operators, tasks, schedules, taskRequirements] = await Promise.all([
    storage.getAllOperators(),
    storage.getAllTasks(),
    storage.getAllSchedules(),
    storage.getAllTaskRequirements(),
  ]);

  // Push operators
  for (const operator of operators) {
    try {
      await supabaseStorage.saveOperator(operator);
      pushed.operators++;
    } catch (error) {
      errors.push(`Operator ${operator.name}: ${(error as Error).message}`);
    }
  }

  // Push tasks
  for (const task of tasks) {
    try {
      await supabaseStorage.saveTask(task);
      pushed.tasks++;
    } catch (error) {
      errors.push(`Task ${task.name}: ${(error as Error).message}`);
    }
  }

  // Push schedules
  for (const schedule of schedules) {
    try {
      await supabaseStorage.saveSchedule(schedule);
      pushed.schedules++;
    } catch (error) {
      errors.push(`Schedule ${schedule.weekLabel}: ${(error as Error).message}`);
    }
  }

  // Push task requirements
  for (const req of taskRequirements) {
    try {
      await supabaseStorage.saveTaskRequirement(req);
      pushed.taskRequirements++;
    } catch (error) {
      errors.push(`Task requirement ${req.taskId}: ${(error as Error).message}`);
    }
  }

  return { pushed, errors };
}

/**
 * Pull data from Supabase to local
 */
export async function pullFromCloud(): Promise<{
  pulled: { operators: number; tasks: number; schedules: number; taskRequirements: number };
  errors: string[];
}> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }

  const errors: string[] = [];
  const pulled = { operators: 0, tasks: 0, schedules: 0, taskRequirements: 0 };

  try {
    const cloudData = await supabaseStorage.pullAllData();

    // Import operators
    for (const operator of cloudData.operators) {
      try {
        await storage.saveOperator(operator);
        pulled.operators++;
      } catch (error) {
        errors.push(`Operator ${operator.name}: ${(error as Error).message}`);
      }
    }

    // Import tasks
    for (const task of cloudData.tasks) {
      try {
        await storage.saveTask(task);
        pulled.tasks++;
      } catch (error) {
        errors.push(`Task ${task.name}: ${(error as Error).message}`);
      }
    }

    // Import schedules
    for (const schedule of cloudData.schedules) {
      try {
        await storage.saveSchedule(schedule);
        pulled.schedules++;
      } catch (error) {
        errors.push(`Schedule ${schedule.weekLabel}: ${(error as Error).message}`);
      }
    }

    // Import task requirements
    for (const req of cloudData.taskRequirements) {
      try {
        await storage.saveTaskRequirement(req);
        pulled.taskRequirements++;
      } catch (error) {
        errors.push(`Task requirement ${req.taskId}: ${(error as Error).message}`);
      }
    }

    // Import scheduling rules
    if (cloudData.schedulingRules) {
      const settings = await storage.getSettings();
      if (settings) {
        await storage.saveSettings({
          ...settings,
          schedulingRules: cloudData.schedulingRules,
        });
      }
    }
  } catch (error) {
    errors.push(`Pull failed: ${(error as Error).message}`);
  }

  return { pulled, errors };
}

/**
 * Clear all local data (use with caution!)
 */
export async function clearLocalData(): Promise<void> {
  const operators = await storage.getAllOperators();
  const tasks = await storage.getAllTasks();
  const schedules = await storage.getAllSchedules();

  for (const op of operators) {
    await storage.deleteOperator(op.id);
  }

  for (const task of tasks) {
    await storage.deleteTask(task.id);
  }

  for (const schedule of schedules) {
    await storage.deleteSchedule(schedule.id);
  }

  console.log('[DataExport] Local data cleared');
}

/**
 * Get summary of local data
 */
export async function getDataSummary(): Promise<{
  operators: number;
  tasks: number;
  schedules: number;
  taskRequirements: number;
  lastScheduleDate: string | null;
}> {
  const [operators, tasks, schedules, taskRequirements] = await Promise.all([
    storage.getAllOperators(),
    storage.getAllTasks(),
    storage.getAllSchedules(),
    storage.getAllTaskRequirements(),
  ]);

  // Find most recent schedule
  const sortedSchedules = schedules.sort(
    (a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime()
  );

  return {
    operators: operators.length,
    tasks: tasks.length,
    schedules: schedules.length,
    taskRequirements: taskRequirements.length,
    lastScheduleDate: sortedSchedules[0]?.weekStartDate || null,
  };
}
