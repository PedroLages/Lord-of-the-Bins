/**
 * Repair Phase
 *
 * This module implements the repair phase of the enhanced scheduler.
 * When the greedy phase leaves some constraints unsatisfied, the repair
 * phase attempts to fix them through targeted swaps.
 *
 * Key insight: Instead of backtracking (expensive), we try to swap
 * operators between tasks to satisfy requirements. This is effective
 * because violations are usually caused by "wrong" early assignments.
 */

import type { Operator, TaskType, WeekDay, TaskRequirement, ScheduleAssignment } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type { ScheduleResult } from '../schedulingService';
import type { ConstraintViolation, RepairSwap } from './constraintTypes';

/**
 * Attempt to repair constraint violations through targeted swaps.
 *
 * @param assignments - Current assignments (will be mutated)
 * @param operators - Available operators
 * @param tasks - All tasks
 * @param days - Days being scheduled
 * @param taskRequirements - Requirements to satisfy
 * @param maxIterations - Maximum repair attempts
 * @returns true if all violations were resolved
 */
export function repairViolations(
  assignments: ScheduleResult['assignments'],
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  taskRequirements: TaskRequirement[],
  maxIterations: number = 50
): { success: boolean; iterations: number; remaining: ConstraintViolation[] } {
  console.log('[Repair] Starting repair phase');

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const violations = findViolations(assignments, taskRequirements, days, tasks);

    if (violations.length === 0) {
      console.log(`[Repair] ✅ All violations resolved in ${iteration} iterations`);
      return { success: true, iterations: iteration, remaining: [] };
    }

    console.log(`[Repair] Iteration ${iteration + 1}: ${violations.length} violations`);

    // Pick the most critical violation (under > over, then by shortage size)
    const violation = violations.sort((a, b) => {
      // Under-staffing is more critical than over-staffing
      if (a.type === 'under' && b.type === 'over') return -1;
      if (a.type === 'over' && b.type === 'under') return 1;

      // Bigger shortage is more critical
      const aGap = Math.abs(a.required - a.actual);
      const bGap = Math.abs(b.required - b.actual);
      return bGap - aGap;
    })[0];

    console.log(`[Repair] Addressing: ${violation.description}`);

    let resolved = false;

    if (violation.type === 'under') {
      // Need more operators for this task
      const swap = findSwapToIncrease(
        assignments,
        violation,
        operators,
        tasks,
        taskRequirements
      );

      if (swap) {
        applySwap(assignments, swap);
        console.log(`[Repair] Swap applied: ${swap.description}`);
        resolved = true;
      }
    } else {
      // Over-assigned - need to move someone away
      const swap = findSwapToDecrease(
        assignments,
        violation,
        operators,
        tasks,
        taskRequirements
      );

      if (swap) {
        applySwap(assignments, swap);
        console.log(`[Repair] Swap applied: ${swap.description}`);
        resolved = true;
      }
    }

    if (!resolved) {
      console.log(`[Repair] ⚠️ Cannot fix: ${violation.description}`);
      // Try next violation instead of giving up
      const remainingViolations = violations.slice(1);
      if (remainingViolations.length === 0) {
        return { success: false, iterations: iteration + 1, remaining: violations };
      }
    }
  }

  const remaining = findViolations(assignments, taskRequirements, days, tasks);
  console.log(`[Repair] Max iterations reached. ${remaining.length} violations remain`);
  return { success: false, iterations: maxIterations, remaining };
}

/**
 * Find all constraint violations in current assignments.
 */
export function findViolations(
  assignments: ScheduleResult['assignments'],
  taskRequirements: TaskRequirement[],
  days: WeekDay[],
  tasks: TaskType[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  // Build assignment counts
  const fillCounts = new Map<string, number>();
  for (const assignment of assignments) {
    const key = `${assignment.day}-${assignment.taskId}`;
    fillCounts.set(key, (fillCounts.get(key) || 0) + 1);
  }

  // Check each requirement
  for (const req of taskRequirements) {
    if (req.enabled === false) continue;

    const task = tasks.find(t => t.id === req.taskId);
    if (!task) continue;

    for (const day of days) {
      const requirements = getRequirementsForDay(req, day);
      const required = getTotalFromRequirements(requirements);
      const key = `${day}-${req.taskId}`;
      const actual = fillCounts.get(key) || 0;

      if (actual < required) {
        violations.push({
          type: 'under',
          taskId: req.taskId,
          taskName: task.name,
          day,
          required,
          actual,
          description: `${task.name} on ${day}: ${actual}/${required} (short ${required - actual})`,
        });
      } else if (actual > required && required > 0) {
        violations.push({
          type: 'over',
          taskId: req.taskId,
          taskName: task.name,
          day,
          required,
          actual,
          description: `${task.name} on ${day}: ${actual}/${required} (excess ${actual - required})`,
        });
      }
    }
  }

  return violations;
}

/**
 * Find a swap that increases staffing for an understaffed task.
 *
 * Strategy: Find an operator on another task who:
 * 1. Can do the understaffed task (has skill)
 * 2. Is on a task that has excess (or no strict requirement)
 */
function findSwapToIncrease(
  assignments: ScheduleResult['assignments'],
  violation: ConstraintViolation,
  operators: Operator[],
  tasks: TaskType[],
  taskRequirements: TaskRequirement[]
): RepairSwap | null {
  const targetTask = tasks.find(t => t.id === violation.taskId);
  if (!targetTask) return null;

  // Find operators assigned to other tasks on this day
  const dayAssignments = assignments.filter(a => a.day === violation.day && a.taskId !== violation.taskId);

  for (const assignment of dayAssignments) {
    const operator = operators.find(o => o.id === assignment.operatorId);
    if (!operator) continue;

    // Can this operator do the target task?
    if (!operator.skills.includes(targetTask.requiredSkill)) continue;

    // What task is this operator currently on?
    const currentTask = tasks.find(t => t.id === assignment.taskId);
    if (!currentTask) continue;

    // Would removing them from their current task create a NEW violation?
    const currentTaskReq = taskRequirements.find(r => r.taskId === assignment.taskId);
    if (currentTaskReq && currentTaskReq.enabled !== false) {
      const requirements = getRequirementsForDay(currentTaskReq, violation.day);
      const required = getTotalFromRequirements(requirements);
      const currentCount = countAssignments(assignments, assignment.taskId, violation.day);

      // Only swap if current task has excess (more than required)
      if (currentCount <= required) continue;
    }

    return {
      operatorId: operator.id,
      operatorName: operator.name,
      fromTaskId: assignment.taskId,
      fromTaskName: currentTask.name,
      toTaskId: violation.taskId,
      toTaskName: targetTask.name,
      day: violation.day,
      description: `Move ${operator.name} from ${currentTask.name} to ${targetTask.name} on ${violation.day}`,
    };
  }

  // Alternative: Find an UNASSIGNED operator who can do this task
  const assignedOperatorIds = new Set(
    assignments.filter(a => a.day === violation.day).map(a => a.operatorId)
  );

  for (const operator of operators) {
    if (assignedOperatorIds.has(operator.id)) continue;
    if (operator.status !== 'Active' || operator.archived) continue;
    if (!operator.availability[violation.day]) continue;
    if (!operator.skills.includes(targetTask.requiredSkill)) continue;

    // This operator is available and can do the task - just assign them
    // Return a "swap" from nothing to the target task
    return {
      operatorId: operator.id,
      operatorName: operator.name,
      fromTaskId: '',
      fromTaskName: '(unassigned)',
      toTaskId: violation.taskId,
      toTaskName: targetTask.name,
      day: violation.day,
      description: `Assign ${operator.name} to ${targetTask.name} on ${violation.day}`,
    };
  }

  return null;
}

/**
 * Find a swap that decreases staffing for an overstaffed task.
 *
 * Strategy: Move one operator from the overstaffed task to:
 * 1. An understaffed task they can do
 * 2. Or just remove them (if they have no other options)
 */
function findSwapToDecrease(
  assignments: ScheduleResult['assignments'],
  violation: ConstraintViolation,
  operators: Operator[],
  tasks: TaskType[],
  taskRequirements: TaskRequirement[]
): RepairSwap | null {
  // Find operators on this overstaffed task
  const taskAssignments = assignments.filter(
    a => a.day === violation.day && a.taskId === violation.taskId
  );

  // Find understaffed tasks on this day
  const understaffedTasks = findUnderstaffedTasks(
    assignments,
    taskRequirements,
    violation.day,
    tasks
  );

  for (const assignment of taskAssignments) {
    const operator = operators.find(o => o.id === assignment.operatorId);
    if (!operator) continue;

    const currentTask = tasks.find(t => t.id === assignment.taskId);
    if (!currentTask) continue;

    // Try to move to an understaffed task
    for (const underTask of understaffedTasks) {
      if (operator.skills.includes(underTask.requiredSkill)) {
        return {
          operatorId: operator.id,
          operatorName: operator.name,
          fromTaskId: violation.taskId,
          fromTaskName: currentTask.name,
          toTaskId: underTask.id,
          toTaskName: underTask.name,
          day: violation.day,
          description: `Move ${operator.name} from ${currentTask.name} to ${underTask.name} on ${violation.day}`,
        };
      }
    }
  }

  return null;
}

/**
 * Apply a swap to the assignments array.
 */
function applySwap(
  assignments: ScheduleResult['assignments'],
  swap: RepairSwap
): void {
  if (swap.fromTaskId) {
    // Find and update the existing assignment
    const idx = assignments.findIndex(
      a => a.day === swap.day && a.operatorId === swap.operatorId && a.taskId === swap.fromTaskId
    );

    if (idx >= 0) {
      assignments[idx] = {
        day: swap.day,
        operatorId: swap.operatorId,
        taskId: swap.toTaskId,
      };
    }
  } else {
    // New assignment (operator was unassigned)
    assignments.push({
      day: swap.day,
      operatorId: swap.operatorId,
      taskId: swap.toTaskId,
    });
  }
}

/**
 * Count assignments for a task on a day.
 */
function countAssignments(
  assignments: ScheduleResult['assignments'],
  taskId: string,
  day: WeekDay
): number {
  return assignments.filter(a => a.taskId === taskId && a.day === day).length;
}

/**
 * Find understaffed tasks on a specific day.
 */
function findUnderstaffedTasks(
  assignments: ScheduleResult['assignments'],
  taskRequirements: TaskRequirement[],
  day: WeekDay,
  tasks: TaskType[]
): TaskType[] {
  const understaffed: TaskType[] = [];

  for (const req of taskRequirements) {
    if (req.enabled === false) continue;

    const task = tasks.find(t => t.id === req.taskId);
    if (!task) continue;

    const requirements = getRequirementsForDay(req, day);
    const required = getTotalFromRequirements(requirements);
    const actual = countAssignments(assignments, req.taskId, day);

    if (actual < required) {
      understaffed.push(task);
    }
  }

  return understaffed;
}
