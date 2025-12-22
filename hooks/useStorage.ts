import { useState, useEffect, useCallback, useRef } from 'react';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement, AppearanceSettings, WeeklyExclusions, FillGapsSettings, PlanningTemplate } from '../types';
import { DEFAULT_APPEARANCE_SETTINGS, DEFAULT_FILL_GAPS_SETTINGS } from '../types';
import type { SchedulingRules } from '../services/schedulingService';
import { storage, hybridStorage, initializeStorage, migrateActivityLogFromLocalStorage, StorageError } from '../services/storage';
import type { AppSettings } from '../services/storage';

/**
 * Storage state shape
 */
export interface StorageState {
  operators: Operator[];
  tasks: TaskType[];
  schedules: Record<string, WeeklySchedule>;
  theme: 'Modern' | 'Midnight';
  schedulingRules: SchedulingRules;
  taskRequirements: TaskRequirement[];
  skills?: string[];
  appearance: AppearanceSettings;
  fillGapsSettings: FillGapsSettings;
}

/**
 * Loading states
 */
export type LoadingState = 'loading' | 'ready' | 'error';

/**
 * Error info
 */
export interface StorageErrorInfo {
  code: 'NOT_SUPPORTED' | 'QUOTA_EXCEEDED' | 'READ_ERROR' | 'WRITE_ERROR' | 'UNKNOWN';
  message: string;
}

/**
 * Return type for useStorage hook
 */
export interface UseStorageResult {
  // State
  loadingState: LoadingState;
  error: StorageErrorInfo | null;
  isFirstTime: boolean;

  // Data (null until loaded)
  initialData: StorageState | null;

  // Persistence methods
  saveOperators: (operators: Operator[]) => Promise<void>;
  saveOperator: (operator: Operator) => Promise<void>;
  saveTasks: (tasks: TaskType[]) => Promise<void>;
  saveTask: (task: TaskType) => Promise<void>;
  saveSchedule: (schedule: WeeklySchedule) => Promise<void>;
  saveSettings: (theme: 'Modern' | 'Midnight', rules: SchedulingRules, skills?: string[]) => Promise<void>;
  saveTaskRequirement: (requirement: TaskRequirement) => Promise<void>;
  deleteTaskRequirement: (taskId: string) => Promise<void>;
  saveSkills: (skills: string[]) => Promise<void>;
  saveAppearance: (appearance: AppearanceSettings) => Promise<void>;
  saveFillGapsSettings: (settings: FillGapsSettings) => Promise<void>;

  // Weekly Exclusions (Leave Management)
  getWeeklyExclusions: (year: number, weekNumber: number) => Promise<WeeklyExclusions | undefined>;
  saveWeeklyExclusions: (exclusions: WeeklyExclusions) => Promise<void>;
  deleteWeeklyExclusions: (id: string) => Promise<void>;

  // Planning Templates
  getAllPlanningTemplates: () => Promise<PlanningTemplate[]>;
  savePlanningTemplate: (template: PlanningTemplate) => Promise<void>;
  deletePlanningTemplate: (id: string) => Promise<void>;

  // Utilities
  exportData: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

/**
 * Debounce helper for saving
 */
function useDebouncedSave<T>(
  saveFn: (data: T) => Promise<void>,
  delay: number = 500
): (data: T) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const latestDataRef = useRef<T>();

  return useCallback(
    (data: T) => {
      latestDataRef.current = data;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (latestDataRef.current !== undefined) {
          try {
            await saveFn(latestDataRef.current);
          } catch (error) {
            console.error('Failed to save:', error);
          }
        }
      }, delay);
    },
    [saveFn, delay]
  );
}

/**
 * Hook for managing persistent storage
 *
 * Usage:
 * ```tsx
 * const { loadingState, initialData, saveOperators, saveSchedule } = useStorage({ enabled: isAuthenticated });
 *
 * if (loadingState === 'loading') return <LoadingScreen />;
 * if (loadingState === 'error') return <ErrorScreen />;
 *
 * // Use initialData to set up your state
 * const [operators, setOperators] = useState(initialData.operators);
 *
 * // Call save methods when data changes
 * const handleUpdateOperator = (op) => {
 *   setOperators(prev => [...prev, op]);
 *   saveOperator(op);
 * };
 * ```
 */
export function useStorage(options: { enabled?: boolean } = {}): UseStorageResult {
  const { enabled = true } = options;
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<StorageErrorInfo | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [initialData, setInitialData] = useState<StorageState | null>(null);

  // Initialize on mount (only when enabled)
  useEffect(() => {
    if (!enabled) {
      // Keep in loading state until enabled
      return;
    }

    async function init() {
      try {
        // Initialize storage and load data
        const result = await initializeStorage();

        // Migrate activity log from localStorage (one-time)
        await migrateActivityLogFromLocalStorage();

        // Load task requirements
        const taskRequirements = await storage.getAllTaskRequirements();

        setInitialData({
          operators: result.operators,
          tasks: result.tasks,
          schedules: result.schedules,
          theme: result.settings.theme,
          schedulingRules: result.settings.schedulingRules,
          taskRequirements,
          skills: result.settings.skills,
          appearance: result.settings.appearance || DEFAULT_APPEARANCE_SETTINGS,
          fillGapsSettings: result.settings.fillGapsSettings || DEFAULT_FILL_GAPS_SETTINGS,
        });

        setIsFirstTime(result.isFirstTime);
        setLoadingState('ready');

        if (result.isFirstTime) {
          console.log('Welcome! Default data has been loaded.');
        } else {
          console.log('Data loaded from storage:', {
            operators: result.operators.length,
            tasks: result.tasks.length,
            schedules: Object.keys(result.schedules).length,
          });
        }
      } catch (err) {
        console.error('Storage initialization failed:', err);

        if (err instanceof StorageError) {
          setError({ code: err.code, message: err.message });
        } else {
          setError({
            code: 'UNKNOWN',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
        setLoadingState('error');
      }
    }

    init();
  }, [enabled]);

  // Save methods
  const saveOperators = useCallback(async (operators: Operator[]) => {
    try {
      await storage.saveAllOperators(operators);
    } catch (err) {
      console.error('Failed to save operators:', err);
    }
  }, []);

  const saveOperator = useCallback(async (operator: Operator) => {
    try {
      await storage.saveOperator(operator);
    } catch (err) {
      console.error('Failed to save operator:', err);
    }
  }, []);

  const saveTasks = useCallback(async (tasks: TaskType[]) => {
    try {
      await storage.saveAllTasks(tasks);
    } catch (err) {
      console.error('Failed to save tasks:', err);
    }
  }, []);

  const saveTask = useCallback(async (task: TaskType) => {
    try {
      await storage.saveTask(task);
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  }, []);

  const saveSchedule = useCallback(async (schedule: WeeklySchedule) => {
    try {
      await storage.saveSchedule(schedule);
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
  }, []);

  const saveSettings = useCallback(async (theme: 'Modern' | 'Midnight', rules: SchedulingRules, skills?: string[]) => {
    try {
      const settings: AppSettings = {
        id: 'app_settings',
        theme,
        schedulingRules: rules,
        skills,
      };
      await storage.saveSettings(settings);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  const saveSkills = useCallback(async (skills: string[]) => {
    try {
      const currentSettings = await storage.getSettings();
      const settings: AppSettings = {
        id: 'app_settings',
        theme: currentSettings?.theme || 'Modern',
        schedulingRules: currentSettings?.schedulingRules || {} as SchedulingRules,
        skills,
        appearance: currentSettings?.appearance,
      };
      await storage.saveSettings(settings);
    } catch (err) {
      console.error('Failed to save skills:', err);
    }
  }, []);

  const saveAppearance = useCallback(async (appearance: AppearanceSettings) => {
    try {
      const currentSettings = await storage.getSettings();
      const settings: AppSettings = {
        id: 'app_settings',
        theme: currentSettings?.theme || 'Modern',
        schedulingRules: currentSettings?.schedulingRules || {} as SchedulingRules,
        skills: currentSettings?.skills,
        appearance,
        fillGapsSettings: currentSettings?.fillGapsSettings,
      };
      await storage.saveSettings(settings);
    } catch (err) {
      console.error('Failed to save appearance:', err);
    }
  }, []);

  const saveFillGapsSettings = useCallback(async (fillGapsSettings: FillGapsSettings) => {
    try {
      const currentSettings = await storage.getSettings();
      const settings: AppSettings = {
        id: 'app_settings',
        theme: currentSettings?.theme || 'Modern',
        schedulingRules: currentSettings?.schedulingRules || {} as SchedulingRules,
        skills: currentSettings?.skills,
        appearance: currentSettings?.appearance,
        fillGapsSettings,
      };
      await storage.saveSettings(settings);
    } catch (err) {
      console.error('Failed to save fill gaps settings:', err);
    }
  }, []);

  const saveTaskRequirement = useCallback(async (requirement: TaskRequirement) => {
    try {
      await storage.saveTaskRequirement(requirement);
    } catch (err) {
      console.error('Failed to save task requirement:', err);
    }
  }, []);

  const deleteTaskRequirement = useCallback(async (taskId: string) => {
    try {
      await storage.deleteTaskRequirement(taskId);
    } catch (err) {
      console.error('Failed to delete task requirement:', err);
    }
  }, []);

  // Weekly Exclusions (Leave Management)
  const getWeeklyExclusions = useCallback(async (year: number, weekNumber: number) => {
    try {
      return await storage.getWeeklyExclusions(year, weekNumber);
    } catch (err) {
      console.error('Failed to get weekly exclusions:', err);
      return undefined;
    }
  }, []);

  const saveWeeklyExclusions = useCallback(async (exclusions: WeeklyExclusions) => {
    try {
      await storage.saveWeeklyExclusions(exclusions);
    } catch (err) {
      console.error('Failed to save weekly exclusions:', err);
    }
  }, []);

  const deleteWeeklyExclusions = useCallback(async (id: string) => {
    try {
      await storage.deleteWeeklyExclusions(id);
    } catch (err) {
      console.error('Failed to delete weekly exclusions:', err);
    }
  }, []);

  // Planning Templates (use hybridStorage for cloud sync)
  const getAllPlanningTemplates = useCallback(async () => {
    try {
      return await hybridStorage.getAllPlanningTemplates();
    } catch (err) {
      console.error('Failed to get planning templates:', err);
      return [];
    }
  }, []);

  const savePlanningTemplate = useCallback(async (template: PlanningTemplate) => {
    try {
      await hybridStorage.savePlanningTemplate(template);
    } catch (err) {
      console.error('Failed to save planning template:', err);
    }
  }, []);

  const deletePlanningTemplate = useCallback(async (id: string) => {
    try {
      await hybridStorage.deletePlanningTemplate(id);
    } catch (err) {
      console.error('Failed to delete planning template:', err);
    }
  }, []);

  // Export data as JSON file download
  const exportData = useCallback(async () => {
    try {
      const data = await storage.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `lord-of-the-bins-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      throw err;
    }
  }, []);

  // Clear all data
  const clearAllData = useCallback(async () => {
    try {
      await storage.clearAll();
    } catch (err) {
      console.error('Failed to clear data:', err);
      throw err;
    }
  }, []);

  return {
    loadingState,
    error,
    isFirstTime,
    initialData,
    saveOperators,
    saveOperator,
    saveTasks,
    saveTask,
    saveSchedule,
    saveSettings,
    saveSkills,
    saveAppearance,
    saveFillGapsSettings,
    saveTaskRequirement,
    deleteTaskRequirement,
    getWeeklyExclusions,
    saveWeeklyExclusions,
    deleteWeeklyExclusions,
    getAllPlanningTemplates,
    savePlanningTemplate,
    deletePlanningTemplate,
    exportData,
    clearAllData,
  };
}
