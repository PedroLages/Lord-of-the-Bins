/**
 * Data Migration Script: IndexedDB → Supabase
 *
 * This script migrates all existing data from browser IndexedDB to Supabase.
 * Run this once per user to move their local data to the cloud.
 */

import { db } from '../services/storage/database';
import { supabase } from '../lib/supabase';

export interface MigrationResult {
  entity: string;
  success: number;
  failed: number;
  errors: string[];
}

export async function migrateToSupabase(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  try {
    // 1. Get user's shift_id (from auth context)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('No authenticated user found');
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('shift_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    const shiftId = profile.shift_id;

    console.log(`Starting migration for user ${user.id} (shift: ${shiftId})...`);

    // 2. Migrate operators
    results.push(await migrateOperators(shiftId));

    // 3. Migrate tasks
    results.push(await migrateTasks(shiftId));

    // 4. Migrate task requirements
    results.push(await migrateTaskRequirements(shiftId));

    // 5. Migrate schedules
    results.push(await migrateSchedules(shiftId, user.id));

    // 6. Migrate weekly exclusions
    results.push(await migrateWeeklyExclusions(shiftId));

    // 7. Migrate planning templates
    results.push(await migratePlanningTemplates(shiftId));

    // 8. Migrate app settings
    results.push(await migrateAppSettings(shiftId));

    // 9. Migrate activity log
    results.push(await migrateActivityLog(shiftId, user.id));

    console.log('Migration complete!');
    console.table(results);

    return results;
  } catch (error: any) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function migrateOperators(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'operators', success: 0, failed: 0, errors: [] };

  try {
    const operators = await db.operators.toArray();
    console.log(`Migrating ${operators.length} operators...`);

    for (const op of operators) {
      // Skip archived operators (optional - you can include them if you want)
      if (op.archived) {
        console.log(`Skipping archived operator: ${op.name}`);
        continue;
      }

      try {
        const { error } = await supabase.from('operators').upsert({
          id: op.id,
          shift_id: shiftId,
          name: op.name,
          employee_id: op.id, // Use ID as employee_id
          type: op.type,
          status: op.status,
          skills: op.skills,
          availability: op.availability,
          preferred_tasks: op.preferredTasks || [],
          archived: op.archived || false,
        });

        if (error) {
          result.failed++;
          result.errors.push(`${op.name}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${op.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read operators: ${err.message}`);
  }

  return result;
}

async function migrateTasks(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'tasks', success: 0, failed: 0, errors: [] };

  try {
    const tasks = await db.tasks.toArray();
    console.log(`Migrating ${tasks.length} tasks...`);

    for (const task of tasks) {
      try {
        const { error } = await supabase.from('tasks').upsert({
          id: task.id,
          shift_id: shiftId,
          name: task.name,
          required_skill: task.requiredSkill,
          color: task.color,
          text_color: task.textColor || '#FFFFFF',
          is_heavy: ['Troubleshooter', 'Quality checker', 'Exceptions', 'Platform'].includes(task.name),
          archived: false,
        });

        if (error) {
          result.failed++;
          result.errors.push(`${task.name}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${task.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read tasks: ${err.message}`);
  }

  return result;
}

async function migrateTaskRequirements(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'task_requirements', success: 0, failed: 0, errors: [] };

  try {
    const requirements = await db.taskRequirements.toArray();
    console.log(`Migrating ${requirements.length} task requirements...`);

    for (const req of requirements) {
      try {
        const { error } = await supabase.from('task_requirements').upsert({
          task_id: req.taskId,
          shift_id: shiftId,
          enabled: req.enabled,
          default_requirements: req.defaultRequirements,
          day_overrides: req.dayOverrides || {},
        });

        if (error) {
          result.failed++;
          result.errors.push(`Task ${req.taskId}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Task ${req.taskId}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read task requirements: ${err.message}`);
  }

  return result;
}

async function migrateSchedules(shiftId: string, userId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'schedules', success: 0, failed: 0, errors: [] };

  try {
    const schedules = await db.schedules.toArray();
    console.log(`Migrating ${schedules.length} schedules...`);

    for (const schedule of schedules) {
      try {
        // Calculate week start date
        const weekStartDate = getWeekStartDate(schedule.year, schedule.weekNumber);

        const { error } = await supabase.from('schedules').upsert({
          id: schedule.id,
          shift_id: shiftId,
          week_start_date: weekStartDate.toISOString().split('T')[0],
          status: schedule.status,
          locked: schedule.locked || false,
          assignments: schedule.assignments,
          created_by: userId,
          published_by: schedule.status === 'Published' ? userId : null,
          published_at: schedule.status === 'Published' ? new Date().toISOString() : null,
        });

        if (error) {
          result.failed++;
          result.errors.push(`Week ${schedule.year}-W${schedule.weekNumber}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Week ${schedule.year}-W${schedule.weekNumber}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read schedules: ${err.message}`);
  }

  return result;
}

async function migrateWeeklyExclusions(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'weekly_exclusions', success: 0, failed: 0, errors: [] };

  try {
    const exclusions = await db.weeklyExclusions.toArray();
    console.log(`Migrating ${exclusions.length} weekly exclusions...`);

    for (const excl of exclusions) {
      try {
        const { error } = await supabase.from('weekly_exclusions').upsert({
          id: excl.id,
          shift_id: shiftId,
          week_number: excl.weekNumber,
          year: excl.year,
          exclusions: excl.exclusions,
        });

        if (error) {
          result.failed++;
          result.errors.push(`Week ${excl.year}-W${excl.weekNumber}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Week ${excl.year}-W${excl.weekNumber}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read weekly exclusions: ${err.message}`);
  }

  return result;
}

async function migratePlanningTemplates(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'planning_templates', success: 0, failed: 0, errors: [] };

  try {
    const templates = await db.planningTemplates.toArray();
    console.log(`Migrating ${templates.length} planning templates...`);

    for (const template of templates) {
      try {
        const { error } = await supabase.from('planning_templates').upsert({
          id: template.id,
          shift_id: shiftId,
          name: template.name,
          description: template.description || null,
          exclusions: template.exclusions,
          rules: template.rules || null,
        });

        if (error) {
          result.failed++;
          result.errors.push(`${template.name}: ${error.message}`);
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${template.name}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read planning templates: ${err.message}`);
  }

  return result;
}

async function migrateAppSettings(shiftId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'app_settings', success: 0, failed: 0, errors: [] };

  try {
    const settings = await db.settings.get('app_settings');

    if (!settings) {
      console.log('No app settings found to migrate');
      return result;
    }

    console.log('Migrating app settings...');

    try {
      const { error } = await supabase.from('app_settings').upsert({
        shift_id: shiftId,
        theme: settings.theme || 'Modern',
        scheduling_rules: settings.rules || null,
        skills: settings.skills || null,
        appearance: settings.appearance || null,
        fill_gaps_settings: settings.fillGapsSettings || null,
      });

      if (error) {
        result.failed++;
        result.errors.push(`App settings: ${error.message}`);
      } else {
        result.success++;
      }
    } catch (err: any) {
      result.failed++;
      result.errors.push(`App settings: ${err.message}`);
    }
  } catch (err: any) {
    result.errors.push(`Failed to read app settings: ${err.message}`);
  }

  return result;
}

async function migrateActivityLog(shiftId: string, userId: string): Promise<MigrationResult> {
  const result: MigrationResult = { entity: 'activity_log', success: 0, failed: 0, errors: [] };

  try {
    const entries = await db.activityLog.toArray();
    console.log(`Migrating ${entries.length} activity log entries...`);

    for (const entry of entries) {
      try {
        const { error } = await supabase.from('activity_log').insert({
          shift_id: shiftId,
          user_id: userId,
          action_type: entry.type,
          entity_type: entry.details?.entity || 'unknown',
          entity_id: entry.details?.id || null,
          details: entry.details,
          created_at: new Date(entry.timestamp).toISOString(),
        });

        if (error) {
          // Skip duplicates silently
          if (error.code !== '23505') {
            result.failed++;
            result.errors.push(`Entry ${entry.id}: ${error.message}`);
          } else {
            result.success++; // Count as success if duplicate
          }
        } else {
          result.success++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Entry ${entry.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed to read activity log: ${err.message}`);
  }

  return result;
}

// Helper function to calculate week start date
function getWeekStartDate(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - jan4.getDay() + 1 + (weekNumber - 1) * 7);
  return weekStart;
}
