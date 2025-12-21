/**
 * Supabase Storage Service - Lord of the Bins
 *
 * Cloud storage implementation using Supabase.
 * Used by HybridStorageService for cloud sync.
 */

import { getSupabaseClient, isSupabaseConfigured } from './client';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement } from '../../types';
import type { SchedulingRules } from '../schedulingService';
import type { AppSettings } from '../storage/database';

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
    assignments: schedule.days,
  };
}

function mapDbToSchedule(db: any): WeeklySchedule {
  return {
    id: db.local_id || db.id,
    weekStartDate: db.week_start_date,
    weekLabel: db.week_label,
    status: db.status,
    locked: db.locked,
    days: db.assignments || [],
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
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const shiftId = this.requireShiftId();
    const dbOperator = mapOperatorToDb(operator, shiftId);

    const { error } = await supabase
      .from('operators')
      .upsert(dbOperator, { onConflict: 'local_id' });

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
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const shiftId = this.requireShiftId();
    const dbTask = mapTaskToDb(task, shiftId);

    const { error } = await supabase
      .from('tasks')
      .upsert(dbTask, { onConflict: 'local_id' });

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
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const shiftId = this.requireShiftId();
    const dbSchedule = mapScheduleToDb(schedule, shiftId);

    const { error } = await supabase
      .from('schedules')
      .upsert(dbSchedule, { onConflict: 'shift_id,week_start_date' });

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
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const shiftId = this.requireShiftId();

    const { error } = await supabase.from('task_requirements').upsert(
      {
        local_id: req.taskId,
        shift_id: shiftId,
        task_id: req.taskId, // Will need to be mapped to UUID in production
        enabled: true,
        default_requirements: req.defaultRequirements,
        daily_overrides: req.dailyOverrides || {},
      },
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

    return {
      algorithm: data.algorithm as any,
      strictSkillMatching: data.strict_skill_matching,
      allowConsecutiveHeavyShifts: data.allow_consecutive_heavy_shifts,
      prioritizeFlexForExceptions: data.prioritize_flex_for_exceptions,
      respectPreferredStations: data.respect_preferred_stations,
      maxConsecutiveDaysOnSameTask: data.max_consecutive_days_on_same_task,
      fairDistribution: data.fair_distribution,
      balanceWorkload: data.balance_workload,
      autoAssignCoordinators: data.auto_assign_coordinators,
      randomizationFactor: data.randomization_factor,
      prioritizeSkillVariety: data.prioritize_skill_variety,
      useV2Algorithm: false,
    };
  }

  async saveSchedulingRules(rules: SchedulingRules): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const shiftId = this.requireShiftId();

    const { error } = await supabase.from('scheduling_rules').upsert(
      {
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
      },
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

    return {
      id: 'app_settings',
      theme: data.theme as any,
      schedulingRules: await this.getSchedulingRules() || {} as any,
    };
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
  }> {
    const [operators, tasks, schedules, taskRequirements, schedulingRules] = await Promise.all([
      this.getOperators(),
      this.getTasks(),
      this.getAllSchedules(),
      this.getTaskRequirements(),
      this.getSchedulingRules(),
    ]);

    return { operators, tasks, schedules, taskRequirements, schedulingRules };
  }
}

// Export singleton instance
export const supabaseStorage = new SupabaseStorageService();
