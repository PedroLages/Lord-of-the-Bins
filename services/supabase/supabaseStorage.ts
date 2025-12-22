/**
 * Supabase Storage Service - Lord of the Bins
 *
 * Cloud storage implementation using Supabase.
 * Used by HybridStorageService for cloud sync.
 */

import { getSupabaseClient, requireSupabaseClient, isSupabaseConfigured } from './client';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement, PlanningTemplate } from '../../types';
import type { SchedulingRules } from '../schedulingService';
import type { AppSettings } from '../storage/database';
import type { InsertTables, DbOperator, DbTask, DbSchedule, DbTaskRequirement, DbSchedulingRules, DbAppSettings } from './types';

// Type mapping helpers
function mapOperatorToDb(op: Operator, shiftId: string) {
  return {
    local_id: op.id,
    shift_id: shiftId,
    name: op.name,
    employee_id: op.employeeId || null,
    type: op.type,
    status: op.status,
    skills: op.skills,
    availability: op.availability,
    preferred_tasks: op.preferredTasks || [],
    archived: false,
  };
}

function mapDbToOperator(db: any): Operator {
  return {
    id: db.local_id || db.id,
    name: db.name,
    employeeId: db.employee_id,
    type: db.type,
    status: db.status,
    skills: db.skills || [],
    availability: db.availability || { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
    preferredTasks: db.preferred_tasks || [],
  };
}

function mapTaskToDb(task: TaskType, shiftId: string) {
  return {
    local_id: task.id,
    shift_id: shiftId,
    name: task.name,
    required_skill: task.requiredSkill,
    color: task.color,
    text_color: task.textColor || 'white',
    is_heavy: task.isHeavy || false,
    is_coordinator_only: task.isCoordinatorOnly || false,
    archived: false,
  };
}

function mapDbToTask(db: any): TaskType {
  return {
    id: db.local_id || db.id,
    name: db.name,
    requiredSkill: db.required_skill,
    color: db.color,
    textColor: db.text_color,
    isHeavy: db.is_heavy,
    isCoordinatorOnly: db.is_coordinator_only,
  };
}

function mapScheduleToDb(schedule: WeeklySchedule, shiftId: string) {
  return {
    local_id: schedule.id,
    shift_id: shiftId,
    week_start_date: schedule.weekStartDate,
    week_label: schedule.weekLabel,
    status: schedule.status || 'Draft',
    locked: schedule.locked || false,
    assignments: schedule.days as any, // Cast to Json for database storage
  };
}

/**
 * Calculate ISO week number following ISO 8601 standard
 */
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function mapDbToSchedule(db: any): WeeklySchedule {
  // Compute weekNumber and year from weekStartDate using ISO 8601
  const startDate = new Date(db.week_start_date);
  const year = startDate.getFullYear();
  const weekNumber = getISOWeekNumber(startDate);

  return {
    id: db.local_id || db.id,
    weekNumber,
    year,
    weekStartDate: db.week_start_date,
    weekLabel: db.week_label,
    status: db.status,
    locked: db.locked,
    days: db.assignments || [],
  };
}

function mapTemplateToDb(template: PlanningTemplate, shiftId: string) {
  return {
    local_id: template.id,
    shift_id: shiftId,
    name: template.name,
    description: template.description || null,
    exclusions: template.exclusions || [],
    rules: template.rules || [],
  };
}

function mapDbToTemplate(db: any): PlanningTemplate {
  return {
    id: db.local_id || db.id,
    name: db.name,
    description: db.description || undefined,
    exclusions: db.exclusions || [],
    rules: db.rules || [],
    createdAt: db.created_at,
    updatedAt: db.updated_at || undefined,
  };
}

export class SupabaseStorageService {
  private shiftId: string | null = null;

  /**
   * Set the current shift ID (required for all operations)
   */
  setShiftId(shiftId: string) {
    this.shiftId = shiftId;
  }

  /**
   * Get shift ID or throw if not set
   */
  private requireShiftId(): string {
    if (!this.shiftId) {
      throw new Error('Shift ID not set. Call setShiftId() first.');
    }
    return this.shiftId;
  }

  /**
   * Check if Supabase is available
   */
  isAvailable(): boolean {
    return isSupabaseConfigured && getSupabaseClient() !== null;
  }

  // ============================================
  // OPERATORS
  // ============================================

  async getOperators(): Promise<Operator[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('archived', false)
      .order('name');

    if (error) throw new Error(`Failed to fetch operators: ${error.message}`);
    return (data || []).map(mapDbToOperator);
  }

  async saveOperator(operator: Operator): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();
    const dbOperator = mapOperatorToDb(operator, shiftId);

    const { error } = await supabase
      .from('operators')
      .upsert(dbOperator as any, { onConflict: 'local_id' });

    if (error) throw new Error(`Failed to save operator: ${error.message}`);
  }

  async deleteOperator(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('operators')
      .delete()
      .eq('local_id', id);

    if (error) throw new Error(`Failed to delete operator: ${error.message}`);
  }

  // ============================================
  // TASKS
  // ============================================

  async getTasks(): Promise<TaskType[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('archived', false)
      .order('name');

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return (data || []).map(mapDbToTask);
  }

  async saveTask(task: TaskType): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();
    const dbTask = mapTaskToDb(task, shiftId);

    const { error } = await supabase
      .from('tasks')
      .upsert(dbTask as any, { onConflict: 'local_id' });

    if (error) throw new Error(`Failed to save task: ${error.message}`);
  }

  async deleteTask(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('local_id', id);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  // ============================================
  // SCHEDULES
  // ============================================

  async getSchedule(weekStartDate: string): Promise<WeeklySchedule | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start_date', weekStartDate)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch schedule: ${error.message}`);
    }

    return data ? mapDbToSchedule(data) : null;
  }

  async getAllSchedules(): Promise<WeeklySchedule[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('week_start_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch schedules: ${error.message}`);
    return (data || []).map(mapDbToSchedule);
  }

  async saveSchedule(schedule: WeeklySchedule): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();
    const dbSchedule = mapScheduleToDb(schedule, shiftId);

    const { error } = await supabase
      .from('schedules')
      .upsert(dbSchedule as any, { onConflict: 'shift_id,week_start_date' });

    if (error) throw new Error(`Failed to save schedule: ${error.message}`);
  }

  async deleteSchedule(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('local_id', id);

    if (error) throw new Error(`Failed to delete schedule: ${error.message}`);
  }

  // ============================================
  // TASK REQUIREMENTS
  // ============================================

  async getTaskRequirements(): Promise<TaskRequirement[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('task_requirements')
      .select('*')
      .eq('enabled', true);

    if (error) throw new Error(`Failed to fetch task requirements: ${error.message}`);

    return (data || []).map((db) => ({
      taskId: db.local_id || db.task_id,
      defaultRequirements: db.default_requirements as any,
      dailyOverrides: db.daily_overrides as any,
    }));
  }

  async saveTaskRequirement(req: TaskRequirement): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();

    const taskReqData = {
      local_id: req.taskId,
      shift_id: shiftId,
      task_id: req.taskId, // Will need to be mapped to UUID in production
      enabled: true,
      default_requirements: req.defaultRequirements as any, // Cast to Json for database storage
      daily_overrides: (req.dailyOverrides || {}) as any, // Cast to Json for database storage
    };

    const { error } = await supabase.from('task_requirements').upsert(
      taskReqData as any,
      { onConflict: 'shift_id,task_id' }
    );

    if (error) throw new Error(`Failed to save task requirement: ${error.message}`);
  }

  // ============================================
  // SCHEDULING RULES
  // ============================================

  async getSchedulingRules(): Promise<SchedulingRules | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('scheduling_rules')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch scheduling rules: ${error.message}`);
    }

    if (!data) return null;

    // Type assertion for query result
    const rules = data as DbSchedulingRules;

    return {
      algorithm: rules.algorithm as any,
      strictSkillMatching: rules.strict_skill_matching,
      allowConsecutiveHeavyShifts: rules.allow_consecutive_heavy_shifts,
      prioritizeFlexForExceptions: rules.prioritize_flex_for_exceptions,
      respectPreferredStations: rules.respect_preferred_stations,
      maxConsecutiveDaysOnSameTask: rules.max_consecutive_days_on_same_task,
      fairDistribution: rules.fair_distribution,
      balanceWorkload: rules.balance_workload,
      autoAssignCoordinators: rules.auto_assign_coordinators,
      randomizationFactor: rules.randomization_factor,
      prioritizeSkillVariety: rules.prioritize_skill_variety,
      useV2Algorithm: false,
    };
  }

  async saveSchedulingRules(rules: SchedulingRules): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();

    const rulesData = {
      shift_id: shiftId,
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
    };

    const { error } = await supabase.from('scheduling_rules').upsert(
      rulesData as any,
      { onConflict: 'shift_id' }
    );

    if (error) throw new Error(`Failed to save scheduling rules: ${error.message}`);
  }

  // ============================================
  // APP SETTINGS
  // ============================================

  async getSettings(): Promise<AppSettings | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch settings: ${error.message}`);
    }

    if (!data) return null;

    // Type assertion for query result
    const settings = data as DbAppSettings;

    return {
      id: 'app_settings',
      theme: settings.theme as any,
      schedulingRules: await this.getSchedulingRules() || {} as any,
    };
  }

  // ============================================
  // PLANNING TEMPLATES
  // ============================================

  async getAllPlanningTemplates(): Promise<PlanningTemplate[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('planning_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch planning templates: ${error.message}`);
    return (data || []).map(mapDbToTemplate);
  }

  async getPlanningTemplateById(id: string): Promise<PlanningTemplate | undefined> {
    const supabase = getSupabaseClient();
    if (!supabase) return undefined;

    const { data, error } = await supabase
      .from('planning_templates')
      .select('*')
      .eq('local_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return undefined; // Not found
      throw new Error(`Failed to fetch planning template: ${error.message}`);
    }
    return data ? mapDbToTemplate(data) : undefined;
  }

  async savePlanningTemplate(template: PlanningTemplate): Promise<void> {
    if (!this.isAvailable()) return;

    const supabase = requireSupabaseClient();
    const shiftId = this.requireShiftId();
    const dbTemplate = mapTemplateToDb(template, shiftId);

    const { error } = await supabase
      .from('planning_templates')
      .upsert(dbTemplate as any, { onConflict: 'local_id' });

    if (error) throw new Error(`Failed to save planning template: ${error.message}`);
  }

  async deletePlanningTemplate(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { error } = await supabase
      .from('planning_templates')
      .delete()
      .eq('local_id', id);

    if (error) throw new Error(`Failed to delete planning template: ${error.message}`);
  }

  // ============================================
  // SYNC HELPERS
  // ============================================

  /**
   * Pull all data from Supabase (for initial sync)
   */
  async pullAllData(): Promise<{
    operators: Operator[];
    tasks: TaskType[];
    schedules: WeeklySchedule[];
    taskRequirements: TaskRequirement[];
    schedulingRules: SchedulingRules | null;
    planningTemplates: PlanningTemplate[];
  }> {
    const [operators, tasks, schedules, taskRequirements, schedulingRules, planningTemplates] = await Promise.all([
      this.getOperators(),
      this.getTasks(),
      this.getAllSchedules(),
      this.getTaskRequirements(),
      this.getSchedulingRules(),
      this.getAllPlanningTemplates(),
    ]);

    return { operators, tasks, schedules, taskRequirements, schedulingRules, planningTemplates };
  }
}

// Export singleton instance
export const supabaseStorage = new SupabaseStorageService();
