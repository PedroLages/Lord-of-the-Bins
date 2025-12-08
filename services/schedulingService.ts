import { Operator, TaskType, WeekDay, ScheduleAssignment, getRequiredOperatorsForDay } from '../types';

// Configuration for the scheduling algorithm
export interface SchedulingRules {
  strictSkillMatching: boolean;
  allowConsecutiveHeavyShifts: boolean;
  prioritizeFlexForExceptions: boolean;
  respectPreferredStations: boolean;
  maxConsecutiveDaysOnSameTask: number;
  fairDistribution: boolean;
  balanceWorkload: boolean;
  autoAssignCoordinators: boolean; // Whether to auto-assign coordinators (TC) to their tasks
}

export const DEFAULT_RULES: SchedulingRules = {
  strictSkillMatching: true,
  allowConsecutiveHeavyShifts: false,
  prioritizeFlexForExceptions: true,
  respectPreferredStations: true,
  maxConsecutiveDaysOnSameTask: 2,
  fairDistribution: true,
  balanceWorkload: true,
  autoAssignCoordinators: true, // TC auto-assignment enabled by default
};

// Heavy tasks that should be rotated
const HEAVY_TASKS = ['Troubleshooter', 'Exceptions'];

// Tasks that coordinators can be assigned to
const COORDINATOR_TASKS = ['People', 'Process', 'Off process', 'Process/AD'];

interface ScheduleRequestData {
  operators: Operator[];
  tasks: TaskType[];
  days: WeekDay[];
  currentAssignments?: Record<string, Record<string, ScheduleAssignment>>; // dayIndex -> operatorId -> assignment
  rules?: SchedulingRules;
}

interface ScheduleResult {
  assignments: Array<{
    day: WeekDay;
    operatorId: string;
    taskId: string;
  }>;
  warnings: ScheduleWarning[];
}

export interface ScheduleWarning {
  type: 'skill_mismatch' | 'availability_conflict' | 'double_assignment' | 'understaffed' | 'consecutive_heavy';
  message: string;
  day?: WeekDay;
  operatorId?: string;
  taskId?: string;
}

interface OperatorScore {
  operatorId: string;
  taskId: string;
  score: number;
  reasons: string[];
}

/**
 * Generate a smart schedule using constraint-based algorithm
 */
export function generateSmartSchedule(data: ScheduleRequestData): ScheduleResult {
  const { operators, tasks, days, currentAssignments = {}, rules = DEFAULT_RULES } = data;

  const assignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // Track assignments per operator for workload balancing
  const operatorTaskCount: Record<string, number> = {};
  const operatorHeavyTaskCount: Record<string, number> = {};
  const operatorLastTask: Record<string, { taskId: string; consecutiveDays: number }> = {};
  const operatorDailyAssignments: Record<string, Record<string, string>> = {}; // operatorId -> day -> taskId

  // Initialize tracking
  operators.forEach(op => {
    operatorTaskCount[op.id] = 0;
    operatorHeavyTaskCount[op.id] = 0;
    operatorDailyAssignments[op.id] = {};
  });

  // Process each day
  days.forEach((day, dayIndex) => {
    const dayAssignments = currentAssignments[dayIndex] || {};
    const assignedOperatorsToday = new Set<string>();
    const taskAssignmentCount: Record<string, number> = {};

    // First, respect locked assignments
    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if (assignment.locked && assignment.taskId) {
        assignments.push({
          day,
          operatorId: opId,
          taskId: assignment.taskId,
        });
        assignedOperatorsToday.add(opId);
        operatorTaskCount[opId] = (operatorTaskCount[opId] || 0) + 1;
        operatorDailyAssignments[opId][day] = assignment.taskId;
        taskAssignmentCount[assignment.taskId] = (taskAssignmentCount[assignment.taskId] || 0) + 1;

        const task = tasks.find(t => t.id === assignment.taskId);
        if (task && HEAVY_TASKS.includes(task.name)) {
          operatorHeavyTaskCount[opId] = (operatorHeavyTaskCount[opId] || 0) + 1;
        }
      }
    });

    // Get available operators for this day
    const availableOperators = operators.filter(op => {
      // Check if already assigned today
      if (assignedOperatorsToday.has(op.id)) return false;

      // Check availability
      if (!op.availability[day]) {
        return false;
      }

      // Check status
      if (op.status !== 'Active') return false;

      // Check if we should skip coordinators based on setting
      if (op.type === 'Coordinator' && !rules.autoAssignCoordinators) {
        return false;
      }

      return true;
    });

    // Get tasks that need more operators and track how many are already assigned
    const taskAssignedCount: Record<string, number> = {};

    // Count locked assignments per task
    Object.values(dayAssignments).forEach(a => {
      if (a.locked && a.taskId) {
        taskAssignedCount[a.taskId] = (taskAssignedCount[a.taskId] || 0) + 1;
      }
    });

    // Get tasks that still need more operators
    const tasksToAssign = tasks.filter(task => {
      const required = getRequiredOperatorsForDay(task, day);
      const assigned = taskAssignedCount[task.id] || 0;
      return assigned < required;
    });

    // Score each operator-task combination
    const scores: OperatorScore[] = [];

    availableOperators.forEach(op => {
      tasksToAssign.forEach(task => {
        const score = calculateAssignmentScore(
          op,
          task,
          day,
          dayIndex,
          {
            operatorTaskCount,
            operatorHeavyTaskCount,
            operatorLastTask,
            operatorDailyAssignments,
          },
          rules,
          tasks
        );

        if (score.score > 0) {
          scores.push(score);
        }
      });
    });

    // Sort by score (highest first) and assign
    scores.sort((a, b) => b.score - a.score);

    // Track task assignments count (for multiple operators per task)
    const taskAssignmentsThisRound: Record<string, number> = { ...taskAssignedCount };

    scores.forEach(score => {
      // Skip if operator already assigned today
      if (assignedOperatorsToday.has(score.operatorId)) return;

      // Check if task still needs more operators
      const task = tasks.find(t => t.id === score.taskId);
      if (!task) return;

      const required = getRequiredOperatorsForDay(task, day);
      const currentlyAssigned = taskAssignmentsThisRound[score.taskId] || 0;

      // Skip if task has reached its required operators
      if (currentlyAssigned >= required) return;

      assignments.push({
        day,
        operatorId: score.operatorId,
        taskId: score.taskId,
      });

      assignedOperatorsToday.add(score.operatorId);
      taskAssignmentsThisRound[score.taskId] = currentlyAssigned + 1;
      operatorTaskCount[score.operatorId]++;
      operatorDailyAssignments[score.operatorId][day] = score.taskId;

      if (HEAVY_TASKS.includes(task.name)) {
        operatorHeavyTaskCount[score.operatorId]++;
      }

      // Update consecutive tracking
      const lastTask = operatorLastTask[score.operatorId];
      if (lastTask && lastTask.taskId === score.taskId) {
        operatorLastTask[score.operatorId] = {
          taskId: score.taskId,
          consecutiveDays: lastTask.consecutiveDays + 1,
        };
      } else {
        operatorLastTask[score.operatorId] = {
          taskId: score.taskId,
          consecutiveDays: 1,
        };
      }
    });
  });

  return { assignments, warnings };
}

/**
 * Calculate score for assigning an operator to a task
 * Higher score = better match
 */
function calculateAssignmentScore(
  operator: Operator,
  task: TaskType,
  day: WeekDay,
  dayIndex: number,
  tracking: {
    operatorTaskCount: Record<string, number>;
    operatorHeavyTaskCount: Record<string, number>;
    operatorLastTask: Record<string, { taskId: string; consecutiveDays: number }>;
    operatorDailyAssignments: Record<string, Record<string, string>>;
  },
  rules: SchedulingRules,
  allTasks: TaskType[]
): OperatorScore {
  let score = 100; // Base score
  const reasons: string[] = [];

  // HARD CONSTRAINT: Skill matching
  const hasSkill = operator.skills.includes(task.requiredSkill);
  if (!hasSkill) {
    if (rules.strictSkillMatching) {
      return { operatorId: operator.id, taskId: task.id, score: 0, reasons: ['No required skill'] };
    } else {
      score -= 50;
      reasons.push('Missing skill (soft)');
    }
  }

  // HARD CONSTRAINT: Coordinator task restrictions
  if (operator.type === 'Coordinator') {
    const isCoordinatorTask = COORDINATOR_TASKS.some(
      ct => task.name.toLowerCase().includes(ct.toLowerCase())
    );
    if (!isCoordinatorTask) {
      return { operatorId: operator.id, taskId: task.id, score: 0, reasons: ['Coordinator cannot do this task'] };
    }
  }

  // Check for heavy task restrictions
  const isHeavyTask = HEAVY_TASKS.includes(task.name);
  const lastTask = tracking.operatorLastTask[operator.id];

  if (isHeavyTask && lastTask) {
    // Check consecutive heavy shifts
    if (!rules.allowConsecutiveHeavyShifts) {
      const lastTaskObj = allTasks.find(t => t.id === lastTask.taskId);
      if (lastTaskObj && HEAVY_TASKS.includes(lastTaskObj.name)) {
        score -= 30;
        reasons.push('Consecutive heavy shift');
      }
    }

    // Check max consecutive days on same task
    if (lastTask.taskId === task.id && lastTask.consecutiveDays >= rules.maxConsecutiveDaysOnSameTask) {
      score -= 40;
      reasons.push(`Already ${lastTask.consecutiveDays} days on same task`);
    }
  }

  // Prioritize Flex staff for Exceptions
  if (rules.prioritizeFlexForExceptions && task.name === 'Exceptions') {
    if (operator.type === 'Flex') {
      score += 20;
      reasons.push('Flex priority for Exceptions');
    } else {
      score -= 10;
    }
  }

  // Fair distribution - penalize if operator has more heavy tasks than average
  if (rules.fairDistribution && isHeavyTask) {
    const avgHeavyTasks = Object.values(tracking.operatorHeavyTaskCount).reduce((a, b) => a + b, 0) /
      Object.keys(tracking.operatorHeavyTaskCount).length || 0;

    const operatorHeavyCount = tracking.operatorHeavyTaskCount[operator.id] || 0;

    if (operatorHeavyCount > avgHeavyTasks + 1) {
      score -= 15;
      reasons.push('Above average heavy tasks');
    } else if (operatorHeavyCount < avgHeavyTasks) {
      score += 10;
      reasons.push('Below average heavy tasks');
    }
  }

  // Workload balance - penalize if operator has more total tasks
  if (rules.balanceWorkload) {
    const avgTasks = Object.values(tracking.operatorTaskCount).reduce((a, b) => a + b, 0) /
      Object.keys(tracking.operatorTaskCount).length || 0;

    const operatorCount = tracking.operatorTaskCount[operator.id] || 0;

    if (operatorCount > avgTasks + 1) {
      score -= 10;
      reasons.push('Above average workload');
    } else if (operatorCount < avgTasks) {
      score += 5;
      reasons.push('Below average workload');
    }
  }

  return { operatorId: operator.id, taskId: task.id, score, reasons };
}

/**
 * Validate a schedule and return warnings
 */
export function validateSchedule(
  assignments: Record<string, Record<string, ScheduleAssignment>>, // dayIndex -> operatorId -> assignment
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  taskRequirements?: Record<string, Record<string, number>> // taskId -> day -> required count
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  days.forEach((day, dayIndex) => {
    const dayAssignments = assignments[dayIndex] || {};
    const taskCounts: Record<string, number> = {};

    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if (!assignment.taskId) return;

      const operator = operators.find(o => o.id === opId);
      const task = tasks.find(t => t.id === assignment.taskId);

      if (!operator || !task) return;

      // Skill mismatch warning
      if (!operator.skills.includes(task.requiredSkill)) {
        warnings.push({
          type: 'skill_mismatch',
          message: `${operator.name} doesn't have "${task.requiredSkill}" skill for ${task.name}`,
          day,
          operatorId: opId,
          taskId: assignment.taskId,
        });
      }

      // Availability conflict warning
      if (!operator.availability[day]) {
        warnings.push({
          type: 'availability_conflict',
          message: `${operator.name} is not available on ${day}`,
          day,
          operatorId: opId,
        });
      }

      // Coordinator task restriction
      if (operator.type === 'Coordinator') {
        const isCoordinatorTask = COORDINATOR_TASKS.some(
          ct => task.name.toLowerCase().includes(ct.toLowerCase())
        );
        if (!isCoordinatorTask) {
          warnings.push({
            type: 'skill_mismatch',
            message: `Coordinator ${operator.name} can only be assigned to People, Process, or Off-Process`,
            day,
            operatorId: opId,
            taskId: assignment.taskId,
          });
        }
      }

      // Track task counts
      taskCounts[assignment.taskId] = (taskCounts[assignment.taskId] || 0) + 1;
    });

    // Check for understaffed tasks - using explicit requirements or task.requiredOperators
    tasks.forEach(task => {
      // Get required operators - from explicit requirements or from task definition
      let required = 1;
      if (taskRequirements && taskRequirements[task.id]) {
        required = taskRequirements[task.id][day] || 0;
      } else {
        required = getRequiredOperatorsForDay(task, day);
      }

      const assigned = taskCounts[task.id] || 0;

      if (required > 0 && assigned < required) {
        warnings.push({
          type: 'understaffed',
          message: `${task.name} needs ${required} operator${required > 1 ? 's' : ''} on ${day}, only ${assigned} assigned`,
          day,
          taskId: task.id,
        });
      }
    });
  });

  // Check for double assignments (same operator, same day, multiple tasks)
  days.forEach((day, dayIndex) => {
    const dayAssignments = assignments[dayIndex] || {};
    const operatorTasks: Record<string, string[]> = {};

    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if (assignment.taskId) {
        if (!operatorTasks[opId]) operatorTasks[opId] = [];
        operatorTasks[opId].push(assignment.taskId);
      }
    });

    Object.entries(operatorTasks).forEach(([opId, taskIds]) => {
      if (taskIds.length > 1) {
        const operator = operators.find(o => o.id === opId);
        warnings.push({
          type: 'double_assignment',
          message: `${operator?.name || opId} is assigned to ${taskIds.length} tasks on ${day}`,
          day,
          operatorId: opId,
        });
      }
    });
  });

  return warnings;
}
