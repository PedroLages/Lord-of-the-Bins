/**
 * Hybrid Storage Service - Lord of the Bins
 *
 * Combines IndexedDB (local-first) with Supabase (cloud sync).
 * - All reads/writes go to IndexedDB first (instant)
 * - Changes are queued for background sync to Supabase
 * - Real-time updates from Supabase update local state
 */

import { storage } from './index';
import { supabaseStorage, SupabaseStorageService } from '../supabase/supabaseStorage';
import { isSupabaseConfigured, getSupabaseClient } from '../supabase/client';
import { queueSync, subscribeSyncState, getSyncState, retrySyncQueue, SyncState } from '../sync/syncQueue';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement, PlanningTemplate } from '../../types';
import type { SchedulingRules } from '../schedulingService';
import type { AppSettings } from './database';

export interface HybridStorageService {
  // Operators
  getOperators(): Promise<Operator[]>;
  saveOperator(operator: Operator): Promise<void>;
  deleteOperator(id: string): Promise<void>;

  // Tasks
  getTasks(): Promise<TaskType[]>;
  saveTask(task: TaskType): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // Schedules
  getSchedule(weekStartDate: string): Promise<WeeklySchedule | null>;
  getAllSchedules(): Promise<WeeklySchedule[]>;
  saveSchedule(schedule: WeeklySchedule): Promise<void>;
  deleteSchedule(id: string): Promise<void>;

  // Task Requirements
  getTaskRequirements(): Promise<TaskRequirement[]>;
  saveTaskRequirement(req: TaskRequirement): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<void>;
  getSchedulingRules(): Promise<SchedulingRules | null>;
  saveSchedulingRules(rules: SchedulingRules): Promise<void>;

  // Planning Templates
  getAllPlanningTemplates(): Promise<PlanningTemplate[]>;
  getPlanningTemplateById(id: string): Promise<PlanningTemplate | undefined>;
  savePlanningTemplate(template: PlanningTemplate): Promise<void>;
  deletePlanningTemplate(id: string): Promise<void>;

  // Sync
  isCloudEnabled(): boolean;
  getSyncState(): SyncState;
  subscribeSyncState(callback: (state: SyncState) => void): () => void;
  forceSyncToCloud(): Promise<void>;
  pullFromCloud(): Promise<void>;
}

class HybridStorage implements HybridStorageService {
  private cloudStorage: SupabaseStorageService;
  private shiftId: string | null = null;

  constructor() {
    this.cloudStorage = supabaseStorage;
  }

  /**
   * Set the current shift ID for cloud operations
   */
  setShiftId(shiftId: string) {
    this.shiftId = shiftId;
    this.cloudStorage.setShiftId(shiftId);

    // Trigger sync queue processing after authentication
    // This ensures pending items sync immediately when user logs in
    if (shiftId && isSupabaseConfigured) {
      setTimeout(() => retrySyncQueue(), 100);
    }
  }

  isCloudEnabled(): boolean {
    // Only enable cloud sync if:
    // 1. Supabase is configured
    // 2. Storage service is available
    // 3. User is authenticated (has shift_id)
    return isSupabaseConfigured && this.cloudStorage.isAvailable() && this.shiftId !== null;
  }

  getSyncState(): SyncState {
    return getSyncState();
  }

  subscribeSyncState(callback: (state: SyncState) => void): () => void {
    return subscribeSyncState(callback);
  }

  // ============================================
  // OPERATORS
  // ============================================

  async getOperators(): Promise<Operator[]> {
    // Always read from local (instant)
    return storage.getAllOperators();
  }

  async saveOperator(operator: Operator): Promise<void> {
    // 1. Save to local immediately
    await storage.saveOperator(operator);

    // 2. Queue for cloud sync (non-blocking)
    if (this.isCloudEnabled()) {
      queueSync('operators', 'update', operator.id, {
        local_id: operator.id,
        shift_id: this.shiftId,
        name: operator.name,
        employee_id: operator.employeeId,
        type: operator.type,
        status: operator.status,
        skills: operator.skills,
        availability: operator.availability,
        preferred_tasks: operator.preferredTasks || [],
      });
    }
  }

  async deleteOperator(id: string): Promise<void> {
    // 1. Delete from local
    await storage.deleteOperator(id);

    // 2. Queue for cloud sync
    if (this.isCloudEnabled()) {
      queueSync('operators', 'delete', id, { local_id: id });
    }
  }

  // ============================================
  // TASKS
  // ============================================

  async getTasks(): Promise<TaskType[]> {
    return storage.getAllTasks();
  }

  async saveTask(task: TaskType): Promise<void> {
    await storage.saveTask(task);

    if (this.isCloudEnabled()) {
      queueSync('tasks', 'update', task.id, {
        local_id: task.id,
        shift_id: this.shiftId,
        name: task.name,
        required_skill: task.requiredSkill,
        color: task.color,
        text_color: task.textColor,
        is_heavy: task.isHeavy,
        is_coordinator_only: task.isCoordinatorOnly,
      });
    }
  }

  async deleteTask(id: string): Promise<void> {
    await storage.deleteTask(id);

    if (this.isCloudEnabled()) {
      queueSync('tasks', 'delete', id, { local_id: id });
    }
  }

  // ============================================
  // SCHEDULES
  // ============================================

  async getSchedule(weekStartDate: string): Promise<WeeklySchedule | null> {
    const schedules = await storage.getAllSchedules();
    return schedules.find((s) => s.weekStartDate === weekStartDate) || null;
  }

  async getAllSchedules(): Promise<WeeklySchedule[]> {
    return storage.getAllSchedules();
  }

  async saveSchedule(schedule: WeeklySchedule): Promise<void> {
    await storage.saveSchedule(schedule);

    if (this.isCloudEnabled()) {
      queueSync('schedules', 'update', schedule.id, {
        local_id: schedule.id,
        shift_id: this.shiftId,
        week_start_date: schedule.weekStartDate,
        week_label: schedule.weekLabel,
        status: schedule.status,
        locked: schedule.locked,
        assignments: schedule.days,
      });
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    await storage.deleteSchedule(id);

    if (this.isCloudEnabled()) {
      queueSync('schedules', 'delete', id, { local_id: id });
    }
  }

  // ============================================
  // TASK REQUIREMENTS
  // ============================================

  async getTaskRequirements(): Promise<TaskRequirement[]> {
    return storage.getAllTaskRequirements();
  }

  async saveTaskRequirement(req: TaskRequirement): Promise<void> {
    await storage.saveTaskRequirement(req);

    if (this.isCloudEnabled()) {
      queueSync('task_requirements', 'update', req.taskId, {
        local_id: req.taskId,
        shift_id: this.shiftId,
        task_id: req.taskId,
        default_requirements: req.defaultRequirements,
        daily_overrides: req.dailyOverrides || {},
      });
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  async getSettings(): Promise<AppSettings | null> {
    return storage.getSettings();
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await storage.saveSettings(settings);

    // Sync settings to cloud for multi-device support
    if (this.isCloudEnabled() && settings.schedulingRules) {
      queueSync('scheduling_rules', 'upsert', 'rules', {
        local_id: 'rules',
        shift_id: this.shiftId,
        algorithm: settings.schedulingRules.algorithm,
        strict_skill_matching: settings.schedulingRules.strictSkillMatching,
        allow_consecutive_heavy_shifts: settings.schedulingRules.allowConsecutiveHeavyShifts,
        prioritize_flex_for_exceptions: settings.schedulingRules.prioritizeFlexForExceptions,
        respect_preferred_stations: settings.schedulingRules.respectPreferredStations,
        max_consecutive_days_on_same_task: settings.schedulingRules.maxConsecutiveDaysOnSameTask,
        fair_distribution: settings.schedulingRules.fairDistribution,
        balance_workload: settings.schedulingRules.balanceWorkload,
        auto_assign_coordinators: settings.schedulingRules.autoAssignCoordinators,
        randomization_factor: settings.schedulingRules.randomizationFactor,
        prioritize_skill_variety: settings.schedulingRules.prioritizeSkillVariety,
        heavy_tasks: settings.schedulingRules.heavyTasks || [],
        soft_tasks: settings.schedulingRules.softTasks || [],
      });
    }
  }

  async getSchedulingRules(): Promise<SchedulingRules | null> {
    const settings = await storage.getSettings();
    return settings?.schedulingRules || null;
  }

  async saveSchedulingRules(rules: SchedulingRules): Promise<void> {
    const settings = await storage.getSettings();
    if (settings) {
      await storage.saveSettings({
        ...settings,
        schedulingRules: rules,
      });

      if (this.isCloudEnabled()) {
        queueSync('scheduling_rules', 'upsert', 'rules', {
          local_id: 'rules',
          shift_id: this.shiftId,
          algorithm: rules.algorithm,
          strict_skill_matching: rules.strictSkillMatching,
          allow_consecutive_heavy_shifts: rules.allowConsecutiveHeavyShifts,
          prioritize_flex_for_exceptions: rules.prioritizeFlexForExceptions,
          respect_preferred_stations: rules.respectPreferredStations,
          max_consecutive_days_on_same_task: rules.maxConsecutiveDaysOnSameTask,
          fair_distribution: rules.fairDistribution,
          balance_workload: rules.balanceWorkload,
          auto_assign_coordinators: rules.autoAssignCoordinators,
          randomization_factor: rules.randomizationFactor,
          prioritize_skill_variety: rules.prioritizeSkillVariety,
          heavy_tasks: rules.heavyTasks || [],
          soft_tasks: rules.softTasks || [],
        });
      }
    }
  }

  // ============================================
  // PLANNING TEMPLATES
  // ============================================

  async getAllPlanningTemplates(): Promise<PlanningTemplate[]> {
    return storage.getAllPlanningTemplates();
  }

  async getPlanningTemplateById(id: string): Promise<PlanningTemplate | undefined> {
    return storage.getPlanningTemplateById(id);
  }

  async savePlanningTemplate(template: PlanningTemplate): Promise<void> {
    // 1. Save to local immediately
    await storage.savePlanningTemplate(template);

    // 2. Queue for cloud sync (non-blocking)
    if (this.isCloudEnabled()) {
      queueSync('planning_templates', 'upsert', template.id, {
        local_id: template.id,
        shift_id: this.shiftId,
        name: template.name,
        description: template.description || null,
        exclusions: template.exclusions || [],
        rules: template.rules || [],
        created_at: template.createdAt,
      });
    }
  }

  async deletePlanningTemplate(id: string): Promise<void> {
    // 1. Delete from local
    await storage.deletePlanningTemplate(id);

    // 2. Queue for cloud sync
    if (this.isCloudEnabled()) {
      queueSync('planning_templates', 'delete', id, { local_id: id });
    }
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Force sync all local data to cloud
   */
  async forceSyncToCloud(): Promise<void> {
    if (!this.isCloudEnabled()) {
      throw new Error('Cloud sync is not enabled');
    }

    const [operators, tasks, schedules, taskReqs, templates] = await Promise.all([
      this.getOperators(),
      this.getTasks(),
      this.getAllSchedules(),
      this.getTaskRequirements(),
      this.getAllPlanningTemplates(),
    ]);

    // Queue all items for sync
    for (const op of operators) {
      await this.saveOperator(op);
    }
    for (const task of tasks) {
      await this.saveTask(task);
    }
    for (const schedule of schedules) {
      await this.saveSchedule(schedule);
    }
    for (const req of taskReqs) {
      await this.saveTaskRequirement(req);
    }
    for (const template of templates) {
      await this.savePlanningTemplate(template);
    }

    console.log('[HybridStorage] All data queued for cloud sync');
  }

  /**
   * Pull all data from cloud and merge with local
   */
  async pullFromCloud(): Promise<void> {
    if (!this.isCloudEnabled()) {
      throw new Error('Cloud sync is not enabled');
    }

    try {
      const cloudData = await this.cloudStorage.pullAllData();

      // Merge cloud data with local (cloud wins for conflicts)
      // This is a simple merge - in production you'd want more sophisticated conflict resolution

      for (const op of cloudData.operators) {
        await storage.saveOperator(op);
      }

      for (const task of cloudData.tasks) {
        await storage.saveTask(task);
      }

      for (const schedule of cloudData.schedules) {
        await storage.saveSchedule(schedule);
      }

      for (const req of cloudData.taskRequirements) {
        await storage.saveTaskRequirement(req);
      }

      if (cloudData.schedulingRules) {
        const settings = await storage.getSettings();
        if (settings) {
          await storage.saveSettings({
            ...settings,
            schedulingRules: cloudData.schedulingRules,
          });
        }
      }

      for (const template of cloudData.planningTemplates) {
        await storage.savePlanningTemplate(template);
      }

      console.log('[HybridStorage] Cloud data merged with local');
    } catch (error) {
      console.error('[HybridStorage] Failed to pull from cloud:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const hybridStorage = new HybridStorage();
