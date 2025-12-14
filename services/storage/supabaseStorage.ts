/**
 * Supabase Storage Service
 *
 * Implements the StorageService interface using Supabase as the backend.
 * Automatically filters all data by the authenticated user's shift_id via RLS.
 */

import { supabase } from '../supabase/client';
import { getCurrentUser } from '../supabase/authService';
import type { Database } from '../supabase/types';
import type { StorageService } from './storageService';
import type { Operator, TaskType, WeeklySchedule, TaskRequirement, WeeklyExclusions, PlanningTemplate, ScheduleAssignment } from '../../types';
import type { ActivityLogEntry } from '../activityLogService';
import type { AppSettings } from './database';
import { DEFAULT_RULES, type SchedulingRules } from '../schedulingService';

// Type aliases for Supabase row types
type SupabaseOperator = Database['public']['Tables']['operators']['Row'];
type SupabaseTask = Database['public']['Tables']['tasks']['Row'];
type SupabaseSchedule = Database['public']['Tables']['schedules']['Row'];
type SupabaseTaskRequirement = Database['public']['Tables']['task_requirements']['Row'];
type SupabaseSchedulingRules = Database['public']['Tables']['scheduling_rules']['Row'];
type SupabaseActivityLog = Database['public']['Tables']['activity_log']['Row'];

export class SupabaseStorageService implements StorageService {
  private shiftId: string | null = null;
  private userId: string | null = null;

  // ═════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═════════════════════════════════════════════════════════════════════

  async initialize(): Promise<boolean> {
    // Get current user and shift
    const user = await getCurrentUser();
    if (!user || !user.profile) {
      throw new Error('No authenticated user or user profile not found');
    }

    this.userId = user.id;
    this.shiftId = user.profile.shift_id;

    // Check if this is first time for this shift (no operators yet)
    const { data: operators } = await supabase
      .from('operators')
      .select('id')
      .limit(1);

    const isFirstTime = !operators || operators.length === 0;

    // If first time, create default scheduling rules
    if (isFirstTime) {
      await this.createDefaultSchedulingRules();
    }

    return isFirstTime;
  }

  isAvailable(): boolean {
    return this.shiftId !== null;
  }

  // ═════════════════════════════════════════════════════════════════════
  // OPERATORS
  // ═════════════════════════════════════════════════════════════════════

  async getAllOperators(): Promise<Operator[]> {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('archived', false)
      .order('name');

    if (error) throw new Error(`Failed to fetch operators: ${error.message}`);
    return data.map(this.mapOperatorFromDB);
  }

  async getOperatorById(id: string): Promise<Operator | undefined> {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch operator: ${error.message}`);
    return data ? this.mapOperatorFromDB(data) : undefined;
  }

  async saveOperator(operator: Operator): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbOperator = this.mapOperatorToDB(operator);

    // Check if operator exists
    const { data: existing } = await supabase
      .from('operators')
      .select('id')
      .eq('id', operator.id)
      .maybeSingle();

    if (existing) {
      // Update
      const { error } = await supabase
        .from('operators')
        .update(dbOperator)
        .eq('id', operator.id);

      if (error) throw new Error(`Failed to update operator: ${error.message}`);
    } else {
      // Insert
      const { error } = await supabase
        .from('operators')
        .insert({ ...dbOperator, id: operator.id, shift_id: this.shiftId });

      if (error) throw new Error(`Failed to create operator: ${error.message}`);
    }

    // Log activity
    await this.logActivity('operator_updated', 'operator', operator.id, {
      name: operator.name,
    });
  }

  async saveAllOperators(operators: Operator[]): Promise<void> {
    for (const operator of operators) {
      await this.saveOperator(operator);
    }
  }

  async deleteOperator(id: string): Promise<void> {
    const { error } = await supabase
      .from('operators')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete operator: ${error.message}`);

    await this.logActivity('operator_deleted', 'operator', id);
  }

  // ═════════════════════════════════════════════════════════════════════
  // TASKS
  // ═════════════════════════════════════════════════════════════════════

  async getAllTasks(): Promise<TaskType[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('archived', false)
      .order('name');

    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return data.map(this.mapTaskFromDB);
  }

  async getTaskById(id: string): Promise<TaskType | undefined> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch task: ${error.message}`);
    return data ? this.mapTaskFromDB(data) : undefined;
  }

  async saveTask(task: TaskType): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbTask = this.mapTaskToDB(task);

    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', task.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('tasks')
        .update(dbTask)
        .eq('id', task.id);

      if (error) throw new Error(`Failed to update task: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('tasks')
        .insert({ ...dbTask, id: task.id, shift_id: this.shiftId });

      if (error) throw new Error(`Failed to create task: ${error.message}`);
    }

    await this.logActivity('task_updated', 'task', task.id, {
      name: task.name,
    });
  }

  async saveAllTasks(tasks: TaskType[]): Promise<void> {
    for (const task of tasks) {
      await this.saveTask(task);
    }
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);

    await this.logActivity('task_deleted', 'task', id);
  }

  // ═════════════════════════════════════════════════════════════════════
  // SCHEDULES
  // ═════════════════════════════════════════════════════════════════════

  async getAllSchedules(): Promise<WeeklySchedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('week_start_date', { ascending: false });

    if (error) throw new Error(`Failed to fetch schedules: ${error.message}`);
    return data.map(this.mapScheduleFromDB);
  }

  async getScheduleById(id: string): Promise<WeeklySchedule | undefined> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch schedule: ${error.message}`);
    return data ? this.mapScheduleFromDB(data) : undefined;
  }

  async getScheduleByWeek(year: number, weekNumber: number): Promise<WeeklySchedule | undefined> {
    // Calculate week start date from year and week number
    const weekStartDate = this.getWeekStartDate(year, weekNumber);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('week_start_date', weekStartDate.toISOString().split('T')[0])
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`Failed to fetch schedule: ${error.message}`);
    }

    return data ? this.mapScheduleFromDB(data) : undefined;
  }

  async saveSchedule(schedule: WeeklySchedule): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbSchedule = this.mapScheduleToDB(schedule);

    const { data: existing } = await supabase
      .from('schedules')
      .select('id')
      .eq('id', schedule.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('schedules')
        .update(dbSchedule)
        .eq('id', schedule.id);

      if (error) throw new Error(`Failed to update schedule: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('schedules')
        .insert({
          ...dbSchedule,
          id: schedule.id,
          shift_id: this.shiftId,
          created_by: this.userId,
        });

      if (error) throw new Error(`Failed to create schedule: ${error.message}`);
    }

    await this.logActivity('schedule_updated', 'schedule', schedule.id, {
      week: `${schedule.year}-W${schedule.weekNumber}`,
      status: schedule.status,
    });
  }

  async saveAllSchedules(schedules: WeeklySchedule[]): Promise<void> {
    for (const schedule of schedules) {
      await this.saveSchedule(schedule);
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete schedule: ${error.message}`);

    await this.logActivity('schedule_deleted', 'schedule', id);
  }

  // ═════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═════════════════════════════════════════════════════════════════════

  async getSettings(): Promise<AppSettings | undefined> {
    // Settings are stored in scheduling_rules table
    const { data, error } = await supabase
      .from('scheduling_rules')
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch settings: ${error.message}`);
    }

    if (!data) {
      return {
        id: 'app_settings',
        theme: 'Modern',
        schedulingRules: DEFAULT_RULES,
      };
    }

    return {
      id: 'app_settings',
      theme: 'Modern', // Theme is stored per-user in the future
      schedulingRules: this.mapSchedulingRulesFromDB(data),
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbRules = this.mapSchedulingRulesToDB(settings.schedulingRules);

    // Check if rules exist for this shift
    const { data: existing } = await supabase
      .from('scheduling_rules')
      .select('id')
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('scheduling_rules')
        .update(dbRules)
        .eq('id', existing.id);

      if (error) throw new Error(`Failed to update settings: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('scheduling_rules')
        .insert({ ...dbRules, shift_id: this.shiftId });

      if (error) throw new Error(`Failed to create settings: ${error.message}`);
    }

    await this.logActivity('settings_updated', 'settings', 'app-settings');
  }

  // ═════════════════════════════════════════════════════════════════════
  // ACTIVITY LOG
  // ═════════════════════════════════════════════════════════════════════

  async getActivityLog(limit = 100): Promise<ActivityLogEntry[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch activity log: ${error.message}`);
    return data.map(this.mapActivityLogFromDB);
  }

  async addActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
    // Handled by logActivity helper
    await this.logActivity(entry.action, entry.entity, entry.entityId || '', entry.details);
  }

  async clearActivityLog(): Promise<void> {
    const { error } = await supabase
      .from('activity_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw new Error(`Failed to clear activity log: ${error.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════
  // TASK REQUIREMENTS
  // ═════════════════════════════════════════════════════════════════════

  async getAllTaskRequirements(): Promise<TaskRequirement[]> {
    const { data, error } = await supabase
      .from('task_requirements')
      .select('*');

    if (error) throw new Error(`Failed to fetch task requirements: ${error.message}`);
    return data.map(this.mapTaskRequirementFromDB);
  }

  async getTaskRequirement(taskId: string): Promise<TaskRequirement | undefined> {
    const { data, error } = await supabase
      .from('task_requirements')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch task requirement: ${error.message}`);
    }

    return data ? this.mapTaskRequirementFromDB(data) : undefined;
  }

  async saveTaskRequirement(requirement: TaskRequirement): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbRequirement = this.mapTaskRequirementToDB(requirement);

    const { data: existing } = await supabase
      .from('task_requirements')
      .select('id')
      .eq('task_id', requirement.taskId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('task_requirements')
        .update(dbRequirement)
        .eq('id', existing.id);

      if (error) throw new Error(`Failed to update task requirement: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('task_requirements')
        .insert({
          ...dbRequirement,
          task_id: requirement.taskId,
          shift_id: this.shiftId,
        });

      if (error) throw new Error(`Failed to create task requirement: ${error.message}`);
    }
  }

  async saveAllTaskRequirements(requirements: TaskRequirement[]): Promise<void> {
    for (const req of requirements) {
      await this.saveTaskRequirement(req);
    }
  }

  async deleteTaskRequirement(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('task_requirements')
      .delete()
      .eq('task_id', taskId);

    if (error) throw new Error(`Failed to delete task requirement: ${error.message}`);
  }

  // ═════════════════════════════════════════════════════════════════════
  // WEEKLY EXCLUSIONS
  // ═════════════════════════════════════════════════════════════════════

  async getWeeklyExclusions(year: number, weekNumber: number): Promise<WeeklyExclusions | undefined> {
    const { data, error } = await supabase
      .from('weekly_exclusions')
      .select('*')
      .eq('year', year)
      .eq('week_number', weekNumber)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch weekly exclusions: ${error.message}`);
    }

    return data ? this.mapWeeklyExclusionsFromDB(data) : undefined;
  }

  async getWeeklyExclusionsById(id: string): Promise<WeeklyExclusions | undefined> {
    const { data, error } = await supabase
      .from('weekly_exclusions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch weekly exclusions: ${error.message}`);
    return data ? this.mapWeeklyExclusionsFromDB(data) : undefined;
  }

  async getAllWeeklyExclusions(): Promise<WeeklyExclusions[]> {
    const { data, error } = await supabase
      .from('weekly_exclusions')
      .select('*')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false });

    if (error) throw new Error(`Failed to fetch weekly exclusions: ${error.message}`);
    return data.map(this.mapWeeklyExclusionsFromDB);
  }

  async saveWeeklyExclusions(exclusions: WeeklyExclusions): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbExclusions = this.mapWeeklyExclusionsToDB(exclusions);

    const { data: existing } = await supabase
      .from('weekly_exclusions')
      .select('id')
      .eq('id', exclusions.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('weekly_exclusions')
        .update(dbExclusions)
        .eq('id', exclusions.id);

      if (error) throw new Error(`Failed to update weekly exclusions: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('weekly_exclusions')
        .insert({
          ...dbExclusions,
          id: exclusions.id,
          shift_id: this.shiftId,
        });

      if (error) throw new Error(`Failed to create weekly exclusions: ${error.message}`);
    }

    await this.logActivity('weekly_exclusions_updated', 'weekly_exclusions', exclusions.id, {
      week: `${exclusions.year}-W${exclusions.weekNumber}`,
    });
  }

  async deleteWeeklyExclusions(id: string): Promise<void> {
    const { error } = await supabase
      .from('weekly_exclusions')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete weekly exclusions: ${error.message}`);

    await this.logActivity('weekly_exclusions_deleted', 'weekly_exclusions', id);
  }

  // ═════════════════════════════════════════════════════════════════════
  // PLANNING TEMPLATES
  // ═════════════════════════════════════════════════════════════════════

  async getAllPlanningTemplates(): Promise<PlanningTemplate[]> {
    const { data, error } = await supabase
      .from('planning_templates')
      .select('*')
      .order('name');

    if (error) throw new Error(`Failed to fetch planning templates: ${error.message}`);
    return data.map(this.mapPlanningTemplateFromDB);
  }

  async getPlanningTemplateById(id: string): Promise<PlanningTemplate | undefined> {
    const { data, error} = await supabase
      .from('planning_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch planning template: ${error.message}`);
    return data ? this.mapPlanningTemplateFromDB(data) : undefined;
  }

  async savePlanningTemplate(template: PlanningTemplate): Promise<void> {
    if (!this.shiftId) throw new Error('No shift ID available');

    const dbTemplate = this.mapPlanningTemplateToDB(template);

    const { data: existing } = await supabase
      .from('planning_templates')
      .select('id')
      .eq('id', template.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('planning_templates')
        .update(dbTemplate)
        .eq('id', template.id);

      if (error) throw new Error(`Failed to update planning template: ${error.message}`);
    } else {
      const { error } = await supabase
        .from('planning_templates')
        .insert({
          ...dbTemplate,
          id: template.id,
          shift_id: this.shiftId,
        });

      if (error) throw new Error(`Failed to create planning template: ${error.message}`);
    }

    await this.logActivity('planning_template_updated', 'planning_template', template.id, {
      name: template.name,
    });
  }

  async deletePlanningTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('planning_templates')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete planning template: ${error.message}`);

    await this.logActivity('planning_template_deleted', 'planning_template', id);
  }

  // ═════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS - MAPPERS
  // ═════════════════════════════════════════════════════════════════════

  private mapOperatorFromDB(db: SupabaseOperator): Operator {
    return {
      id: db.id,
      name: db.name,
      type: db.type,
      status: db.status,
      skills: db.skills,
      availability: db.availability as Record<string, boolean>,
      preferredTasks: db.preferred_tasks,
      archived: db.archived,
    };
  }

  private mapOperatorToDB(op: Operator): Partial<Database['public']['Tables']['operators']['Insert']> {
    return {
      name: op.name,
      type: op.type,
      status: op.status,
      skills: op.skills,
      availability: op.availability,
      preferred_tasks: op.preferredTasks || [],
      archived: op.archived || false,
    };
  }

  private mapTaskFromDB(db: SupabaseTask): TaskType {
    return {
      id: db.id,
      name: db.name,
      requiredSkill: db.required_skill,
      color: db.color,
      textColor: (db as any).text_color || '#FFFFFF', // Default to white if not set
    };
  }

  private mapTaskToDB(task: TaskType): Partial<Database['public']['Tables']['tasks']['Insert']> {
    return {
      name: task.name,
      required_skill: task.requiredSkill,
      color: task.color,
      text_color: task.textColor || '#FFFFFF',
      is_heavy: ['Troubleshooter', 'Quality checker', 'Exceptions', 'Platform'].includes(task.name),
    };
  }

  private mapScheduleFromDB(db: SupabaseSchedule): WeeklySchedule {
    const weekStartDate = new Date(db.week_start_date);
    const year = weekStartDate.getFullYear();
    const weekNumber = this.getWeekNumber(weekStartDate);

    return {
      id: db.id,
      year,
      weekNumber,
      status: db.status,
      locked: db.locked,
      assignments: db.assignments as Record<string, Record<string, ScheduleAssignment>>,
    };
  }

  private mapScheduleToDB(schedule: WeeklySchedule): Partial<Database['public']['Tables']['schedules']['Insert']> {
    const weekStartDate = this.getWeekStartDate(schedule.year, schedule.weekNumber);

    return {
      week_start_date: weekStartDate.toISOString().split('T')[0],
      status: schedule.status,
      locked: schedule.locked || false,
      assignments: schedule.assignments,
      published_by: schedule.status === 'Published' ? this.userId : null,
      published_at: schedule.status === 'Published' ? new Date().toISOString() : null,
    };
  }

  private mapTaskRequirementFromDB(db: SupabaseTaskRequirement): TaskRequirement {
    return {
      taskId: db.task_id,
      enabled: db.enabled,
      defaultRequirements: db.default_requirements as any,
      dayOverrides: db.day_overrides as any,
    };
  }

  private mapTaskRequirementToDB(req: TaskRequirement): Partial<Database['public']['Tables']['task_requirements']['Insert']> {
    return {
      enabled: req.enabled,
      default_requirements: req.defaultRequirements,
      day_overrides: req.dayOverrides || {},
    };
  }

  private mapSchedulingRulesFromDB(db: SupabaseSchedulingRules): SchedulingRules {
    return {
      strictSkillMatching: db.strict_skill_matching,
      allowConsecutiveHeavyShifts: db.allow_consecutive_heavy_shifts,
      prioritizeFlexForExceptions: db.prioritize_flex_for_exceptions,
      respectPreferredStations: db.respect_preferred_stations,
      maxConsecutiveDaysOnSameTask: db.max_consecutive_days_on_same_task,
      fairDistribution: db.fair_distribution,
      balanceWorkload: db.balance_workload,
      autoAssignCoordinators: db.auto_assign_coordinators,
      randomizationFactor: db.randomization_factor,
      useV2Algorithm: db.use_v2_algorithm,
      prioritizeSkillVariety: db.prioritize_skill_variety,
      algorithm: db.algorithm,
    };
  }

  private mapSchedulingRulesToDB(rules: SchedulingRules): Partial<Database['public']['Tables']['scheduling_rules']['Insert']> {
    return {
      strict_skill_matching: rules.strictSkillMatching,
      allow_consecutive_heavy_shifts: rules.allowConsecutiveHeavyShifts,
      prioritize_flex_for_exceptions: rules.prioritizeFlexForExceptions,
      respect_preferred_stations: rules.respectPreferredStations,
      max_consecutive_days_on_same_task: rules.maxConsecutiveDaysOnSameTask,
      fair_distribution: rules.fairDistribution,
      balance_workload: rules.balanceWorkload,
      auto_assign_coordinators: rules.autoAssignCoordinators,
      randomization_factor: rules.randomizationFactor,
      use_v2_algorithm: rules.useV2Algorithm,
      prioritize_skill_variety: rules.prioritizeSkillVariety,
      algorithm: rules.algorithm,
    };
  }

  private mapActivityLogFromDB(db: SupabaseActivityLog): ActivityLogEntry {
    return {
      id: db.id,
      timestamp: new Date(db.created_at),
      action: db.action_type,
      entity: db.entity_type,
      entityId: db.entity_id || undefined,
      details: db.details as Record<string, any>,
      userId: db.user_id || undefined,
    };
  }

  private mapWeeklyExclusionsFromDB(db: any): WeeklyExclusions {
    return {
      id: db.id,
      weekNumber: db.week_number,
      year: db.year,
      exclusions: db.exclusions,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapWeeklyExclusionsToDB(exclusions: WeeklyExclusions): any {
    return {
      week_number: exclusions.weekNumber,
      year: exclusions.year,
      exclusions: exclusions.exclusions,
      updated_at: new Date().toISOString(),
    };
  }

  private mapPlanningTemplateFromDB(db: any): PlanningTemplate {
    return {
      id: db.id,
      name: db.name,
      description: db.description || undefined,
      exclusions: db.exclusions,
      rules: db.rules || undefined,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
    };
  }

  private mapPlanningTemplateToDB(template: PlanningTemplate): any {
    return {
      name: template.name,
      description: template.description || null,
      exclusions: template.exclusions,
      rules: template.rules || null,
      updated_at: new Date().toISOString(),
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS - UTILITIES
  // ═════════════════════════════════════════════════════════════════════

  private async logActivity(actionType: string, entityType: string, entityId: string, details: Record<string, any> = {}): Promise<void> {
    if (!this.shiftId) return;

    await supabase.from('activity_log').insert({
      shift_id: this.shiftId,
      user_id: this.userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  }

  private async createDefaultSchedulingRules(): Promise<void> {
    if (!this.shiftId) return;

    const { error } = await supabase
      .from('scheduling_rules')
      .insert({
        shift_id: this.shiftId,
        ...this.mapSchedulingRulesToDB(DEFAULT_RULES),
      });

    if (error && error.code !== '23505') { // 23505 = unique violation (already exists)
      console.error('Failed to create default scheduling rules:', error);
    }
  }

  private getWeekStartDate(year: number, weekNumber: number): Date {
    const jan4 = new Date(year, 0, 4);
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - jan4.getDay() + 1 + (weekNumber - 1) * 7);
    return weekStart;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

// Singleton instance
export const storage = new SupabaseStorageService();
