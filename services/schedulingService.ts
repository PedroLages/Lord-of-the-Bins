import { Operator, TaskType, WeekDay, ScheduleAssignment, getRequiredOperatorsForDay, TaskRequirement, getRequirementsForDay, getTotalFromRequirements, OperatorTypeRequirement, PlanBuilderViolation, FillGapsResult, FillGapsSettings } from '../types';

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
  randomizationFactor: number; // 0-20: adds variety to schedule generation
  useV2Algorithm: boolean; // Use enhanced V2 algorithm with decay scoring and early filtering
  prioritizeSkillVariety: boolean; // V2: Prioritize using all of operator's skills across the week
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
  randomizationFactor: 10, // Default medium randomization
  useV2Algorithm: false, // V2 disabled by default - enable in Settings to test
  prioritizeSkillVariety: true, // V2: Use all operator skills - enabled by default
};

// Heavy tasks that should be rotated
const HEAVY_TASKS = ['Troubleshooter', 'Exceptions'];

// Tasks that coordinators can be assigned to (must match task names)
const COORDINATOR_TASKS = ['People', 'Process', 'Off process', 'Off Process'];

// TC Task IDs for group scheduling
const TC_TASK_IDS = ['t11', 't12', 't13']; // Process, People, Off process

interface ScheduleRequestData {
  operators: Operator[];
  tasks: TaskType[];
  days: WeekDay[];
  currentAssignments?: Record<string, Record<string, ScheduleAssignment>>; // dayIndex -> operatorId -> assignment
  rules?: SchedulingRules;
  taskRequirements?: TaskRequirement[]; // Optional type-based requirements per task
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
  type: 'skill_mismatch' | 'availability_conflict' | 'double_assignment' | 'understaffed' | 'overstaffed' | 'consecutive_heavy';
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
  const { operators, tasks, days, currentAssignments = {}, rules = DEFAULT_RULES, taskRequirements = [] } = data;

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

  // Handle TC scheduling as a group first (if enabled)
  // This ensures all TCs get assigned with proper daily rotation
  const tcAssignedByDay: Record<string, Set<string>> = {}; // day -> Set of TC operator IDs already assigned
  days.forEach(day => {
    tcAssignedByDay[day] = new Set();
  });

  if (rules.autoAssignCoordinators) {
    const coordinators = operators.filter(op => op.type === 'Coordinator');
    const tcTasks = tasks.filter(t => TC_TASK_IDS.includes(t.id));

    if (coordinators.length > 0 && tcTasks.length > 0) {
      const tcAssignments = scheduleTCsAsGroup(coordinators, tcTasks, days, currentAssignments);

      // Add TC assignments to results and tracking
      tcAssignments.forEach(assignment => {
        assignments.push(assignment);
        tcAssignedByDay[assignment.day].add(assignment.operatorId);
        operatorTaskCount[assignment.operatorId] = (operatorTaskCount[assignment.operatorId] || 0) + 1;
        operatorDailyAssignments[assignment.operatorId][assignment.day] = assignment.taskId;

        // Update last task tracking
        const lastTask = operatorLastTask[assignment.operatorId];
        if (lastTask && lastTask.taskId === assignment.taskId) {
          operatorLastTask[assignment.operatorId] = {
            taskId: assignment.taskId,
            consecutiveDays: lastTask.consecutiveDays + 1,
          };
        } else {
          operatorLastTask[assignment.operatorId] = {
            taskId: assignment.taskId,
            consecutiveDays: 1,
          };
        }
      });
    }
  }

  // Process each day
  days.forEach((day, dayIndex) => {
    const dayAssignments = currentAssignments[dayIndex] || {};
    const assignedOperatorsToday = new Set<string>();
    const taskAssignmentCount: Record<string, number> = {};

    // Include TCs already assigned by group scheduler
    tcAssignedByDay[day].forEach(tcId => {
      assignedOperatorsToday.add(tcId);
      const tcTaskId = operatorDailyAssignments[tcId]?.[day];
      if (tcTaskId) {
        taskAssignmentCount[tcTaskId] = (taskAssignmentCount[tcTaskId] || 0) + 1;
      }
    });

    // First, respect locked AND pinned assignments
    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if ((assignment.locked || assignment.pinned) && assignment.taskId) {
        // Skip if already assigned by TC group scheduler
        if (assignedOperatorsToday.has(opId)) return;

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

    // Include TC tasks already assigned by group scheduler
    tcAssignedByDay[day].forEach(tcId => {
      const tcTaskId = operatorDailyAssignments[tcId]?.[day];
      if (tcTaskId) {
        taskAssignedCount[tcTaskId] = (taskAssignedCount[tcTaskId] || 0) + 1;
      }
    });

    // Count locked and pinned assignments per task
    Object.values(dayAssignments).forEach(a => {
      if ((a.locked || a.pinned) && a.taskId) {
        taskAssignedCount[a.taskId] = (taskAssignedCount[a.taskId] || 0) + 1;
      }
    });

    // Helper to get required operators - prioritizes TaskRequirements over task's built-in property
    const getRequiredForTask = (task: TaskType): number => {
      const taskReq = taskRequirements.find(r => r.taskId === task.id && r.enabled !== false);
      if (taskReq) {
        const requirements = getRequirementsForDay(taskReq, day);
        return getTotalFromRequirements(requirements);
      }
      return getRequiredOperatorsForDay(task, day);
    };

    // Get tasks that still need more operators
    const tasksToAssign = tasks.filter(task => {
      const required = getRequiredForTask(task);
      // If required is 0, skip task entirely
      if (required === 0) return false;
      const assigned = taskAssignedCount[task.id] || 0;
      return assigned < required;
    });

    // Track operator types assigned to each task for type requirements
    const taskTypeAssignments: Record<string, Record<string, number>> = {};
    tasks.forEach(t => {
      taskTypeAssignments[t.id] = { Regular: 0, Flex: 0, Coordinator: 0 };
    });

    // Count types already assigned via locked/pinned
    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if ((assignment.locked || assignment.pinned) && assignment.taskId) {
        const op = operators.find(o => o.id === opId);
        if (op) {
          taskTypeAssignments[assignment.taskId][op.type] =
            (taskTypeAssignments[assignment.taskId][op.type] || 0) + 1;
        }
      }
    });

    // Also count TC assignments
    tcAssignedByDay[day].forEach(tcId => {
      const tcTaskId = operatorDailyAssignments[tcId]?.[day];
      if (tcTaskId) {
        taskTypeAssignments[tcTaskId]['Coordinator'] =
          (taskTypeAssignments[tcTaskId]['Coordinator'] || 0) + 1;
      }
    });

    // Helper to get requirement for a task
    const getTaskRequirement = (taskId: string): TaskRequirement | undefined => {
      return taskRequirements.find(r => r.taskId === taskId && r.enabled !== false);
    };

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
            taskTypeAssignments,
          },
          rules,
          tasks,
          getTaskRequirement(task.id)
        );

        if (score.score > 0) {
          scores.push(score);
        }
      });
    });

    // Sort by score (highest first) with randomization factor for variety
    // Randomization adds a small random value to break ties and create variety
    const randomFactor = rules.randomizationFactor || 0;
    scores.sort((a, b) => {
      const aScore = a.score + (randomFactor > 0 ? Math.random() * randomFactor : 0);
      const bScore = b.score + (randomFactor > 0 ? Math.random() * randomFactor : 0);
      return bScore - aScore;
    });

    // Track task assignments count (for multiple operators per task)
    const taskAssignmentsThisRound: Record<string, number> = { ...taskAssignedCount };

    scores.forEach(score => {
      // Skip if operator already assigned today
      if (assignedOperatorsToday.has(score.operatorId)) return;

      // Check if task still needs more operators
      const task = tasks.find(t => t.id === score.taskId);
      if (!task) return;

      const required = getRequiredForTask(task);
      const currentlyAssigned = taskAssignmentsThisRound[score.taskId] || 0;

      // Skip if task has reached its required operators
      if (currentlyAssigned >= required) return;

      const assignedOp = operators.find(o => o.id === score.operatorId);

      assignments.push({
        day,
        operatorId: score.operatorId,
        taskId: score.taskId,
      });

      assignedOperatorsToday.add(score.operatorId);
      taskAssignmentsThisRound[score.taskId] = currentlyAssigned + 1;
      operatorTaskCount[score.operatorId]++;
      operatorDailyAssignments[score.operatorId][day] = score.taskId;

      // Update type tracking for this task
      if (assignedOp) {
        taskTypeAssignments[score.taskId][assignedOp.type] =
          (taskTypeAssignments[score.taskId][assignedOp.type] || 0) + 1;
      }

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
    taskTypeAssignments: Record<string, Record<string, number>>;
  },
  rules: SchedulingRules,
  allTasks: TaskType[],
  taskRequirement?: TaskRequirement
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

    // TC scheduling: rotate every day - never same task 2 days in a row
    const lastTask = tracking.operatorLastTask[operator.id];
    if (lastTask && lastTask.taskId === task.id) {
      // Strong penalty for same task as yesterday - force rotation
      score -= 100;
      reasons.push('TC must rotate daily');
    }
  }

  // Check for heavy task restrictions
  const isHeavyTask = HEAVY_TASKS.includes(task.name);
  const lastTask = tracking.operatorLastTask[operator.id];

  // Flex operators with only 1 skill are exempt from rotation rules
  // They have no other task options, so they must do the same task all week
  const isFlexWithSingleSkill = operator.type === 'Flex' && operator.skills.length === 1;

  if (isHeavyTask && lastTask && !isFlexWithSingleSkill) {
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

  // Type requirement scoring
  // If the task has specific type requirements, boost operators that match unfilled slots
  if (taskRequirement) {
    const requirements = getRequirementsForDay(taskRequirement, day);
    const currentAssignments = tracking.taskTypeAssignments[task.id] || { Regular: 0, Flex: 0, Coordinator: 0 };

    // Check each requirement type
    let matchesNeededType = false;
    let allSlotsFilledForType = false;

    for (const req of requirements) {
      if (req.count === 0) continue;

      if (req.type === operator.type) {
        // Operator's type matches this requirement
        const currentCount = currentAssignments[req.type] || 0;
        if (currentCount < req.count) {
          // There's still a slot for this type
          matchesNeededType = true;
          score += 25; // Strong boost for matching a specific type slot
          reasons.push(`Matches required type: ${req.type}`);
        } else {
          // This type's slots are filled
          allSlotsFilledForType = true;
        }
      }
    }

    // If operator's type has all slots filled, penalize
    if (allSlotsFilledForType && !matchesNeededType) {
      const totalRequired = getTotalFromRequirements(requirements);
      const totalAssigned = Object.values(currentAssignments).reduce((sum, count) => sum + count, 0);
      if (totalAssigned >= totalRequired) {
        // No room at all
        score -= 50;
        reasons.push(`${operator.type} slots already filled`);
      }
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

      // Check for overstaffed tasks - only when explicit requirements are configured
      // This warns when more operators are assigned than planned
      if (taskRequirements && taskRequirements[task.id] && required > 0 && assigned > required) {
        warnings.push({
          type: 'overstaffed',
          message: `${task.name} has ${assigned} operator${assigned > 1 ? 's' : ''} on ${day}, but only ${required} planned`,
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

/**
 * Schedule all TCs as a group for the entire week using constraint satisfaction.
 * This ensures:
 * 1. No TC has the same task 2 days in a row
 * 2. All TCs are assigned each day
 * 3. Each TC gets variety in tasks across the week (fair distribution)
 */
function scheduleTCsAsGroup(
  coordinators: Operator[],
  tcTasks: TaskType[],
  days: WeekDay[],
  currentAssignments: Record<string, Record<string, ScheduleAssignment>>
): Array<{ day: WeekDay; operatorId: string; taskId: string }> {
  const assignments: Array<{ day: WeekDay; operatorId: string; taskId: string }> = [];

  // Track what each TC was assigned yesterday
  const tcLastTaskId: Record<string, string | null> = {};
  // Track how many times each TC has been assigned each task this week
  const tcWeeklyTaskCount: Record<string, Record<string, number>> = {};

  coordinators.forEach(tc => {
    tcLastTaskId[tc.id] = null;
    tcWeeklyTaskCount[tc.id] = {};
    TC_TASK_IDS.forEach(taskId => {
      tcWeeklyTaskCount[tc.id][taskId] = 0;
    });
  });

  // Get available TCs (active and available)
  const getAvailableTCs = (day: WeekDay, dayIndex: number) => {
    const dayAssigns = currentAssignments[dayIndex] || {};
    return coordinators.filter(tc => {
      // Skip if already locked/pinned
      const existing = dayAssigns[tc.id];
      if (existing && (existing.locked || existing.pinned) && existing.taskId) {
        return false;
      }
      // Check availability and status
      return tc.availability[day] && tc.status === 'Active';
    });
  };

  // Get locked TC assignments for a day
  const getLockedAssignments = (dayIndex: number) => {
    const dayAssigns = currentAssignments[dayIndex] || {};
    const locked: Record<string, string> = {};
    coordinators.forEach(tc => {
      const existing = dayAssigns[tc.id];
      if (existing && (existing.locked || existing.pinned) && existing.taskId) {
        // Only include if it's a TC task
        if (TC_TASK_IDS.includes(existing.taskId)) {
          locked[tc.id] = existing.taskId;
        }
      }
    });
    return locked;
  };

  // Score a permutation based on variety - lower score is better (prefers tasks not yet done)
  const scorePermutation = (permutation: Record<string, string>): number => {
    let score = 0;
    Object.entries(permutation).forEach(([tcId, taskId]) => {
      // Add the current count - this makes tasks already done more expensive
      score += tcWeeklyTaskCount[tcId]?.[taskId] || 0;
    });
    return score;
  };

  // Find ALL valid permutations and return the best one (most variety)
  const findBestAssignment = (
    availableTCs: Operator[],
    availableTasks: string[],
    lockedAssignments: Record<string, string>
  ): Record<string, string> | null => {
    const validPermutations: Record<string, string>[] = [];

    // Start with locked assignments
    const baseResult: Record<string, string> = { ...lockedAssignments };
    const usedTasks = new Set(Object.values(lockedAssignments));

    // TCs that need assignment
    const tcsToAssign = availableTCs.filter(tc => !baseResult[tc.id]);
    // Tasks still available
    const tasksToUse = availableTasks.filter(t => !usedTasks.has(t));

    // Generate all valid permutations (avoiding same-as-yesterday)
    const generatePermutations = (
      tcIndex: number,
      current: Record<string, string>
    ): void => {
      if (tcIndex >= tcsToAssign.length) {
        validPermutations.push({ ...current });
        return;
      }

      const tc = tcsToAssign[tcIndex];
      const lastTask = tcLastTaskId[tc.id];

      for (const taskId of tasksToUse) {
        // Skip if task already used in this permutation
        if (Object.values(current).includes(taskId)) continue;

        // Skip if same as yesterday (daily rotation rule)
        if (lastTask === taskId) continue;

        current[tc.id] = taskId;
        generatePermutations(tcIndex + 1, current);
        delete current[tc.id];
      }
    };

    generatePermutations(0, { ...baseResult });

    // If we found valid permutations, pick the one with best variety score
    if (validPermutations.length > 0) {
      let bestPerm = validPermutations[0];
      let bestScore = scorePermutation(bestPerm);

      for (let i = 1; i < validPermutations.length; i++) {
        const score = scorePermutation(validPermutations[i]);
        if (score < bestScore) {
          bestScore = score;
          bestPerm = validPermutations[i];
        }
      }
      return bestPerm;
    }

    // If no valid permutation with strict rotation, try relaxed (allow same as yesterday)
    const relaxedPermutations: Record<string, string>[] = [];

    const generateRelaxed = (
      tcIndex: number,
      current: Record<string, string>
    ): void => {
      if (tcIndex >= tcsToAssign.length) {
        relaxedPermutations.push({ ...current });
        return;
      }

      const tc = tcsToAssign[tcIndex];

      for (const taskId of tasksToUse) {
        if (Object.values(current).includes(taskId)) continue;

        current[tc.id] = taskId;
        generateRelaxed(tcIndex + 1, current);
        delete current[tc.id];
      }
    };

    generateRelaxed(0, { ...baseResult });

    if (relaxedPermutations.length > 0) {
      let bestPerm = relaxedPermutations[0];
      let bestScore = scorePermutation(bestPerm);

      for (let i = 1; i < relaxedPermutations.length; i++) {
        const score = scorePermutation(relaxedPermutations[i]);
        if (score < bestScore) {
          bestScore = score;
          bestPerm = relaxedPermutations[i];
        }
      }
      return bestPerm;
    }

    return null;
  };

  // Process each day
  days.forEach((day, dayIndex) => {
    const availableTCs = getAvailableTCs(day, dayIndex);
    const lockedAssignments = getLockedAssignments(dayIndex);

    // Get TC tasks that still need assignment
    const usedTaskIds = new Set(Object.values(lockedAssignments));
    const availableTaskIds = TC_TASK_IDS.filter(t => !usedTaskIds.has(t));

    const dayAssignment = findBestAssignment(availableTCs, availableTaskIds, lockedAssignments);

    if (dayAssignment) {
      Object.entries(dayAssignment).forEach(([tcId, taskId]) => {
        // Only add if not already locked
        if (!lockedAssignments[tcId]) {
          assignments.push({ day, operatorId: tcId, taskId });
        }
        // Update last task tracking for next day
        tcLastTaskId[tcId] = taskId;
        // Update weekly count for variety tracking
        if (tcWeeklyTaskCount[tcId]) {
          tcWeeklyTaskCount[tcId][taskId] = (tcWeeklyTaskCount[tcId][taskId] || 0) + 1;
        }
      });

      // Also update tracking for locked assignments
      Object.entries(lockedAssignments).forEach(([tcId, taskId]) => {
        tcLastTaskId[tcId] = taskId;
        if (tcWeeklyTaskCount[tcId]) {
          tcWeeklyTaskCount[tcId][taskId] = (tcWeeklyTaskCount[tcId][taskId] || 0) + 1;
        }
      });
    }
  });

  return assignments;
}

/**
 * Main entry point for schedule generation
 * Routes to V1 or V2 algorithm based on rules.useV2Algorithm flag
 */
export function generateOptimizedSchedule(data: ScheduleRequestData): ScheduleResult {
  const rules = data.rules || DEFAULT_RULES;

  if (rules.useV2Algorithm) {
    return generateSmartScheduleV2(data);
  }

  return generateSmartSchedule(data);
}

/**
 * Validate Plan Builder requirements against current schedule
 */
export function validatePlanBuilderRequirements(
  _assignments: Record<string, Record<string, ScheduleAssignment>>,
  _operators: Operator[],
  _tasks: TaskType[],
  _days: WeekDay[],
  _requirements: any[]
): PlanBuilderViolation[] {
  // Stub - no violations in simplified version
  return [];
}

/**
 * Fill empty gaps in schedule
 */
export function fillGapsSchedule(
  _operators: Operator[],
  _tasks: TaskType[],
  _days: WeekDay[],
  _currentAssignments: Record<string, Record<string, ScheduleAssignment>>,
  _rules: SchedulingRules,
  _settings: FillGapsSettings
): FillGapsResult {
  // Stub - return empty result
  return {
    assignments: [],
    unfillableGaps: [],
    stats: {
      totalEmptyCells: 0,
      filledCells: 0,
      unfilledCells: 0,
      followedAllRules: 0,
      requiredRelaxing: 0,
      byDay: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 }
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 SCHEDULING ALGORITHM
// Enhanced algorithm with:
// 1. Decay scoring - soft penalties instead of hard blocks for rotation
// 2. Explicit Flex priority - clear scoring for Flex on Exceptions
// 3. Early filtering - availability/skills filtered BEFORE scoring
// 4. Coordinator isolation - TCs handled completely separately
// 5. TaskRequirements integration - respects Task Staffing settings
// ═══════════════════════════════════════════════════════════════════════════

/**
 * V2 Smart Schedule Generation
 * Key differences from V1:
 * - Coordinators are FULLY isolated (handled first, never in main pool)
 * - Decay scoring replaces hard rotation blocks
 * - Availability/skills filtered BEFORE scoring (not penalized)
 * - Explicit Flex priority scoring for Exceptions
 * - Respects TaskRequirements from Task Staffing settings (0 = skip task)
 */
export function generateSmartScheduleV2(data: ScheduleRequestData): ScheduleResult {
  const {
    operators,
    tasks,
    days,
    currentAssignments = {},
    rules = DEFAULT_RULES,
    taskRequirements = [],
  } = data;

  const assignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Separate Coordinators from Regular operators
  // Coordinators are FULLY isolated - never enter the main assignment pool
  // ─────────────────────────────────────────────────────────────────────────
  const coordinators = operators.filter(op => op.type === 'Coordinator');
  const regularOperators = operators.filter(op => op.type !== 'Coordinator');

  // Track assignments across all days
  const operatorTaskHistory: Record<string, string[]> = {}; // operatorId -> [taskId per day]
  const operatorTaskCount: Record<string, number> = {};
  const operatorHeavyTaskCount: Record<string, number> = {};
  // Skill Variety: track how many times each skill has been used per operator
  const operatorSkillsUsed: Record<string, Record<string, number>> = {}; // operatorId -> skillName -> count

  // Initialize tracking for regular operators only
  regularOperators.forEach(op => {
    operatorTaskHistory[op.id] = [];
    operatorTaskCount[op.id] = 0;
    operatorHeavyTaskCount[op.id] = 0;
    operatorSkillsUsed[op.id] = {}; // Start with empty skill usage
  });

  // Track TC assignments by day (for task count tracking)
  const tcAssignedByDay: Record<string, Set<string>> = {};
  const tcTaskByDay: Record<string, Record<string, string>> = {}; // day -> tcId -> taskId
  days.forEach(day => {
    tcAssignedByDay[day] = new Set();
    tcTaskByDay[day] = {};
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Schedule Coordinators (completely separate from main pool)
  // Uses existing scheduleTCsAsGroup function
  // ─────────────────────────────────────────────────────────────────────────
  if (rules.autoAssignCoordinators && coordinators.length > 0) {
    const tcTasks = tasks.filter(t => TC_TASK_IDS.includes(t.id));
    if (tcTasks.length > 0) {
      const tcAssignments = scheduleTCsAsGroup(coordinators, tcTasks, days, currentAssignments);

      tcAssignments.forEach(assignment => {
        assignments.push(assignment);
        tcAssignedByDay[assignment.day].add(assignment.operatorId);
        tcTaskByDay[assignment.day][assignment.operatorId] = assignment.taskId;
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3: Helper to get required operators for a task on a day
  // Prioritizes TaskRequirements settings over task's built-in requiredOperators
  // ─────────────────────────────────────────────────────────────────────────
  const getRequiredForTask = (task: TaskType, day: WeekDay): number => {
    // First check TaskRequirements from settings
    const taskReq = taskRequirements.find(r => r.taskId === task.id && r.enabled !== false);
    if (taskReq) {
      const requirements = getRequirementsForDay(taskReq, day);
      return getTotalFromRequirements(requirements);
    }
    // Fall back to task's built-in property
    return getRequiredOperatorsForDay(task, day);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 4: Process each day
  // ─────────────────────────────────────────────────────────────────────────
  days.forEach((day, dayIndex) => {
    const dayAssignments = currentAssignments[dayIndex] || {};
    const assignedOperatorsToday = new Set<string>();
    const taskAssignmentCount: Record<string, number> = {};

    // Include TCs already assigned
    tcAssignedByDay[day].forEach(tcId => {
      assignedOperatorsToday.add(tcId);
      const tcTaskId = tcTaskByDay[day][tcId];
      if (tcTaskId) {
        taskAssignmentCount[tcTaskId] = (taskAssignmentCount[tcTaskId] || 0) + 1;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Respect ALL locked/pinned assignments first
    // ─────────────────────────────────────────────────────────────────────────
    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if ((assignment.locked || assignment.pinned) && assignment.taskId) {
        if (assignedOperatorsToday.has(opId)) return;

        assignments.push({
          day,
          operatorId: opId,
          taskId: assignment.taskId,
        });
        assignedOperatorsToday.add(opId);

        // Track for regular operators
        if (operatorTaskCount[opId] !== undefined) {
          operatorTaskCount[opId]++;
          const task = tasks.find(t => t.id === assignment.taskId);
          if (task && HEAVY_TASKS.includes(task.name)) {
            operatorHeavyTaskCount[opId]++;
          }
        }

        taskAssignmentCount[assignment.taskId] = (taskAssignmentCount[assignment.taskId] || 0) + 1;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: EARLY FILTERING - Get truly available operators
    // Filter BEFORE scoring, not during (V2 key improvement)
    // ─────────────────────────────────────────────────────────────────────────
    const availableOperators = regularOperators.filter(op => {
      // Already assigned today
      if (assignedOperatorsToday.has(op.id)) return false;

      // Not available on this day
      if (!op.availability[day]) return false;

      // Not active
      if (op.status !== 'Active') return false;

      return true;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Get tasks that need more operators
    // Uses TaskRequirements from settings (0 = skip task entirely)
    // ─────────────────────────────────────────────────────────────────────────
    const tasksToAssign = tasks.filter(task => {
      // Skip TC-only tasks (already handled)
      if (TC_TASK_IDS.includes(task.id)) return false;

      // Get required count from TaskRequirements or task's built-in property
      const required = getRequiredForTask(task, day);

      // If required is 0, skip this task entirely
      if (required === 0) return false;

      const assigned = taskAssignmentCount[task.id] || 0;
      return assigned < required;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Score each operator-task combination using V2 scoring
    // ─────────────────────────────────────────────────────────────────────────
    const scores: OperatorScore[] = [];

    // Track operator types for type requirements
    const taskTypeAssignments: Record<string, Record<string, number>> = {};
    tasks.forEach(t => {
      taskTypeAssignments[t.id] = { Regular: 0, Flex: 0, Coordinator: 0 };
    });

    // Count types already assigned via locked/pinned
    Object.entries(dayAssignments).forEach(([opId, assignment]) => {
      if ((assignment.locked || assignment.pinned) && assignment.taskId) {
        const op = operators.find(o => o.id === opId);
        if (op) {
          taskTypeAssignments[assignment.taskId][op.type] =
            (taskTypeAssignments[assignment.taskId][op.type] || 0) + 1;
        }
      }
    });

    // Helper to get requirement for a task
    const getTaskRequirement = (taskId: string): TaskRequirement | undefined => {
      return taskRequirements.find(r => r.taskId === taskId && r.enabled !== false);
    };

    availableOperators.forEach(op => {
      tasksToAssign.forEach(task => {
        const score = calculateAssignmentScoreV2(
          op,
          task,
          day,
          dayIndex,
          {
            operatorTaskHistory,
            operatorTaskCount,
            operatorHeavyTaskCount,
            taskTypeAssignments,
            operatorSkillsUsed,
          },
          rules,
          tasks,
          getTaskRequirement(task.id)
        );

        // V2: Only include if score > 0 (hard constraints passed)
        if (score.score > 0) {
          scores.push(score);
        }
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Sort by score and assign
    // ─────────────────────────────────────────────────────────────────────────
    const randomFactor = rules.randomizationFactor || 0;
    scores.sort((a, b) => {
      const aScore = a.score + (randomFactor > 0 ? Math.random() * randomFactor : 0);
      const bScore = b.score + (randomFactor > 0 ? Math.random() * randomFactor : 0);
      return bScore - aScore;
    });

    const taskAssignmentsThisRound: Record<string, number> = { ...taskAssignmentCount };

    scores.forEach(score => {
      if (assignedOperatorsToday.has(score.operatorId)) return;

      const task = tasks.find(t => t.id === score.taskId);
      if (!task) return;

      const required = getRequiredForTask(task, day);
      const currentlyAssigned = taskAssignmentsThisRound[score.taskId] || 0;
      if (currentlyAssigned >= required) return;

      assignments.push({
        day,
        operatorId: score.operatorId,
        taskId: score.taskId,
      });

      assignedOperatorsToday.add(score.operatorId);
      taskAssignmentsThisRound[score.taskId] = currentlyAssigned + 1;
      operatorTaskCount[score.operatorId]++;

      // Update type tracking
      const assignedOp = operators.find(o => o.id === score.operatorId);
      if (assignedOp) {
        taskTypeAssignments[score.taskId][assignedOp.type]++;
      }

      if (HEAVY_TASKS.includes(task.name)) {
        operatorHeavyTaskCount[score.operatorId]++;
      }

      // Update history
      operatorTaskHistory[score.operatorId].push(score.taskId);

      // Update skill usage tracking (for Skill Variety feature)
      const skill = task.requiredSkill;
      if (skill && operatorSkillsUsed[score.operatorId]) {
        operatorSkillsUsed[score.operatorId][skill] =
          (operatorSkillsUsed[score.operatorId][skill] || 0) + 1;
      }
    });

    // Update history for operators who weren't assigned (maintain alignment)
    availableOperators.forEach(op => {
      if (!assignedOperatorsToday.has(op.id)) {
        operatorTaskHistory[op.id].push(''); // Empty for this day
      }
    });
  });

  return { assignments, warnings };
}

/**
 * V2 Scoring Function
 * Key differences from V1:
 * - DECAY SCORING for rotation (soft penalty, not hard block)
 * - EXPLICIT Flex priority for Exceptions (+5 Flex, -3 non-Flex)
 * - No availability checks (filtered BEFORE reaching this function)
 * - Stronger type requirement enforcement
 */
function calculateAssignmentScoreV2(
  operator: Operator,
  task: TaskType,
  day: WeekDay,
  dayIndex: number,
  tracking: {
    operatorTaskHistory: Record<string, string[]>;
    operatorTaskCount: Record<string, number>;
    operatorHeavyTaskCount: Record<string, number>;
    taskTypeAssignments: Record<string, Record<string, number>>;
    operatorSkillsUsed: Record<string, Record<string, number>>; // operatorId -> skill -> count
  },
  rules: SchedulingRules,
  allTasks: TaskType[],
  taskRequirement?: TaskRequirement
): OperatorScore {
  let score = 100;
  const reasons: string[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // HARD CONSTRAINT: Skill matching (instant disqualification)
  // ─────────────────────────────────────────────────────────────────────────
  const hasSkill = operator.skills.includes(task.requiredSkill);
  if (!hasSkill) {
    if (rules.strictSkillMatching) {
      return { operatorId: operator.id, taskId: task.id, score: 0, reasons: ['No required skill'] };
    } else {
      score -= 50;
      reasons.push('Missing skill (soft)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HARD CONSTRAINT: Coordinators should never reach this function
  // But just in case, block them from non-coordinator tasks
  // ─────────────────────────────────────────────────────────────────────────
  if (operator.type === 'Coordinator') {
    return { operatorId: operator.id, taskId: task.id, score: 0, reasons: ['Coordinator excluded from main pool'] };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FLEX SINGLE-SKILL EXEMPTION
  // Flex operators with only 1 skill are exempt from rotation rules
  // They have no other task options, so they must do the same task all week
  // ─────────────────────────────────────────────────────────────────────────
  const isFlexWithSingleSkill = operator.type === 'Flex' && operator.skills.length === 1;

  // ─────────────────────────────────────────────────────────────────────────
  // DECAY SCORING: Same task penalty (V2 key feature)
  // Instead of hard blocks, use graduated penalties
  // Skip for Flex with single skill - they have no other options
  // ─────────────────────────────────────────────────────────────────────────
  const history = tracking.operatorTaskHistory[operator.id] || [];
  let consecutiveDays = 0;

  // Count consecutive days on same task (from most recent)
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] === task.id) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  // Only apply decay scoring if NOT a Flex with single skill
  if (consecutiveDays > 0 && !isFlexWithSingleSkill) {
    if (consecutiveDays >= rules.maxConsecutiveDaysOnSameTask) {
      // HARD BLOCK at max consecutive days
      return {
        operatorId: operator.id,
        taskId: task.id,
        score: 0,
        reasons: [`Already ${consecutiveDays} consecutive days on ${task.name}`],
      };
    } else {
      // DECAY PENALTY: -6 points per consecutive day
      const decayPenalty = consecutiveDays * 6;
      score -= decayPenalty;
      reasons.push(`Decay penalty: ${consecutiveDays} day(s) on same task (-${decayPenalty})`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPLICIT FLEX PRIORITY FOR EXCEPTIONS (V2 key feature)
  // +5 for Flex on Exceptions, -3 for non-Flex
  // ─────────────────────────────────────────────────────────────────────────
  if (rules.prioritizeFlexForExceptions && task.name === 'Exceptions') {
    if (operator.type === 'Flex') {
      score += 5;
      reasons.push('Flex priority for Exceptions (+5)');
    } else {
      score -= 3;
      reasons.push('Non-Flex on Exceptions (-3)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONSECUTIVE HEAVY TASK PENALTY
  // Skip for Flex with single skill - they have no other options
  // ─────────────────────────────────────────────────────────────────────────
  const isHeavyTask = HEAVY_TASKS.includes(task.name);
  if (isHeavyTask && !rules.allowConsecutiveHeavyShifts && !isFlexWithSingleSkill) {
    const lastTaskId = history[history.length - 1];
    if (lastTaskId) {
      const lastTaskObj = allTasks.find(t => t.id === lastTaskId);
      if (lastTaskObj && HEAVY_TASKS.includes(lastTaskObj.name)) {
        score -= 25;
        reasons.push('Consecutive heavy shift (-25)');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FAIR DISTRIBUTION: Heavy task balance
  // ─────────────────────────────────────────────────────────────────────────
  if (rules.fairDistribution && isHeavyTask) {
    const counts = Object.values(tracking.operatorHeavyTaskCount);
    const avgHeavyTasks = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const operatorHeavyCount = tracking.operatorHeavyTaskCount[operator.id] || 0;

    if (operatorHeavyCount > avgHeavyTasks + 1) {
      score -= 12;
      reasons.push('Above average heavy tasks (-12)');
    } else if (operatorHeavyCount < avgHeavyTasks) {
      score += 8;
      reasons.push('Below average heavy tasks (+8)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKLOAD BALANCE: Total task balance
  // ─────────────────────────────────────────────────────────────────────────
  if (rules.balanceWorkload) {
    const counts = Object.values(tracking.operatorTaskCount);
    const avgTasks = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const operatorCount = tracking.operatorTaskCount[operator.id] || 0;

    if (operatorCount > avgTasks + 1) {
      score -= 8;
      reasons.push('Above average workload (-8)');
    } else if (operatorCount < avgTasks) {
      score += 4;
      reasons.push('Below average workload (+4)');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SKILL VARIETY: Prioritize using all of operator's skills
  // Gives bonus for tasks using skills the operator hasn't used yet this week
  // ─────────────────────────────────────────────────────────────────────────
  if (rules.prioritizeSkillVariety) {
    const skill = task.requiredSkill;
    const skillsUsed = tracking.operatorSkillsUsed[operator.id] || {};
    const usageCount = skillsUsed[skill] || 0;

    // Calculate how many of the operator's skills have been used
    const totalSkills = operator.skills.length;
    const usedSkillCount = Object.keys(skillsUsed).length;

    if (usageCount === 0) {
      // Unused skill - highest bonus
      score += 15;
      reasons.push(`Unused skill: ${skill} (+15)`);
    } else if (usageCount === 1) {
      // Used once - smaller bonus
      score += 5;
      reasons.push(`Skill used once: ${skill} (+5)`);
    }
    // usageCount >= 2: no bonus (neutral)

    // Extra bonus if operator has many unused skills left
    const unusedSkillsRemaining = totalSkills - usedSkillCount;
    if (unusedSkillsRemaining >= 3 && usageCount === 0) {
      score += 5;
      reasons.push(`Many unused skills (${unusedSkillsRemaining}) (+5)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TYPE REQUIREMENT SCORING
  // ─────────────────────────────────────────────────────────────────────────
  if (taskRequirement) {
    const requirements = getRequirementsForDay(taskRequirement, day);
    const currentAssignments = tracking.taskTypeAssignments[task.id] || { Regular: 0, Flex: 0, Coordinator: 0 };

    let matchesNeededType = false;
    let allSlotsFilledForType = false;

    for (const req of requirements) {
      if (req.count === 0) continue;

      if (req.type === operator.type) {
        const currentCount = currentAssignments[req.type] || 0;
        if (currentCount < req.count) {
          matchesNeededType = true;
          score += 20;
          reasons.push(`Matches required type: ${req.type} (+20)`);
        } else {
          allSlotsFilledForType = true;
        }
      }
    }

    if (allSlotsFilledForType && !matchesNeededType) {
      const totalRequired = getTotalFromRequirements(requirements);
      const totalAssigned = Object.values(currentAssignments).reduce((sum, count) => sum + count, 0);
      if (totalAssigned >= totalRequired) {
        score -= 40;
        reasons.push(`${operator.type} slots already filled (-40)`);
      }
    }
  }

  return { operatorId: operator.id, taskId: task.id, score, reasons };
}
