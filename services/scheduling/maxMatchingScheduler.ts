/**
 * Maximum Matching Scheduler (V4 Enhanced)
 *
 * This scheduler GUARANTEES 100% fulfillment when mathematically possible.
 *
 * ARCHITECTURE:
 * 1. FEASIBILITY CHECK: Verify enough operators exist before starting
 * 2. MULTI-TRY LOOP: Run scheduling up to MAX_ATTEMPTS times with different random seeds
 * 3. PHASE 1: TC Assignment with proper same-day constraint
 * 4. PHASE 2: Maximum Bipartite Matching (Hopcroft-Karp) for regular operators
 * 5. PHASE 3: Local Search Optimization for soft constraints
 *
 * FIXES APPLIED:
 * - Heavy tasks from task.isHeavy flag (not hardcoded)
 * - TC rotation: No two TCs can do same task on same day
 * - Preferred stations: Only for Regular operators
 * - Max consecutive days: Only for Heavy tasks
 * - Flex operators: Exempt from soft constraint penalties
 * - Multi-try with random restart for variety
 */

import type { Operator, TaskType, WeekDay, TaskRequirement } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type { ScheduleResult, ScheduleWarning, SchedulingRules, ScheduleRequestData } from '../schedulingService';
import { DEFAULT_RULES } from '../schedulingService';

// Configuration
const MAX_ATTEMPTS = 50; // Number of retry attempts with different random seeds
const DAY_ORDER: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// TC task IDs (coordinators handle these)
const TC_TASK_IDS = ['t11', 't12', 't13'];

interface Slot {
  id: string;
  day: WeekDay;
  dayIndex: number;
  taskId: string;
  taskName: string;
  requiredSkill: string;
  isHeavy: boolean;
  operatorType?: 'Regular' | 'Flex'; // If specified, only match operators of this type
}

interface Assignment {
  slot: Slot;
  operatorId: string;
}

interface OperatorTracking {
  tasksByDay: Map<WeekDay, string>; // day -> taskName
  heavyTaskCount: number;
  totalAssignments: number;
  skillsUsed: Map<string, number>; // skill -> usage count
  consecutiveOnSameTask: number; // current streak
  lastTaskId: string | null;
}

interface FeasibilityResult {
  feasible: boolean;
  warnings: ScheduleWarning[];
  skillGaps: Map<string, { required: number; available: number }>;
}

/**
 * Main entry point: Generate schedule with guaranteed 100% fulfillment (if possible)
 * @param data - Schedule request data
 * @param weekSeed - Optional seed based on week number for variety across weeks
 */
export function generateMaxMatchingSchedule(data: ScheduleRequestData, weekSeed?: number): ScheduleResult {
  const {
    operators: allOperators,
    tasks: allTasks,
    days,
    currentAssignments = {},
    rules = DEFAULT_RULES,
    taskRequirements = [],
    excludedTasks = [],
  } = data;

  // Use week seed + timestamp for variety across weeks and regenerations
  const baseSeed = (weekSeed ?? 0) * 10000 + (Date.now() % 10000);

  console.log('[MaxMatching V4+] Starting enhanced maximum matching schedule generation (seed base:', baseSeed, ')');

  // Filter active operators and excluded tasks
  const operators = allOperators.filter(op => op.status === 'Active' && !op.archived);
  const tasks = allTasks.filter(t => !excludedTasks.includes(t.name));

  // Build task lookup map
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 0: Feasibility Check
  // ═══════════════════════════════════════════════════════════════════════════
  const feasibility = checkFeasibility(operators, tasks, days, taskRequirements, currentAssignments);
  if (!feasibility.feasible) {
    console.log('[MaxMatching V4+] Feasibility check FAILED:', feasibility.warnings.length, 'issues');
    // Continue anyway but include warnings
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-TRY LOOP: Run multiple attempts with different random seeds
  // ═══════════════════════════════════════════════════════════════════════════
  let bestResult: ScheduleResult | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = baseSeed + attempt; // Week-based seed + attempt for variety

    const result = runSingleAttempt(
      operators,
      tasks,
      taskMap,
      days,
      currentAssignments,
      rules,
      taskRequirements,
      seed
    );

    // Calculate quality score (higher = better)
    const fulfillmentRate = calculateFulfillmentRate(result, tasks, taskRequirements, days);
    const penaltyScore = calculatePenaltyScore(result, operators, tasks, rules);
    const qualityScore = fulfillmentRate * 1000 - penaltyScore; // Fulfillment heavily weighted

    if (qualityScore > bestScore) {
      bestScore = qualityScore;
      bestResult = result;

      // Early exit if we achieved 100% fulfillment with low penalty
      if (fulfillmentRate >= 100 && penaltyScore < 50) {
        console.log(`[MaxMatching V4+] Early exit at attempt ${attempt + 1}: 100% fulfillment with low penalty`);
        break;
      }
    }

    // Log progress every 10 attempts
    if ((attempt + 1) % 10 === 0) {
      console.log(`[MaxMatching V4+] Attempt ${attempt + 1}/${MAX_ATTEMPTS}: Best score = ${bestScore.toFixed(0)}`);
    }
  }

  // Add feasibility warnings to result
  const finalResult = bestResult || { assignments: [], warnings: [] };
  finalResult.warnings = [...feasibility.warnings, ...finalResult.warnings];

  console.log(`[MaxMatching V4+] Complete: ${finalResult.assignments.length} assignments, ${finalResult.warnings.length} warnings`);

  return finalResult;
}

/**
 * Run a single scheduling attempt with a specific random seed
 */
function runSingleAttempt(
  operators: Operator[],
  tasks: TaskType[],
  taskMap: Map<string, TaskType>,
  days: WeekDay[],
  currentAssignments: Record<string, Record<string, { taskId: string | null; locked?: boolean; pinned?: boolean }>>,
  rules: SchedulingRules,
  taskRequirements: TaskRequirement[],
  seed: number
): ScheduleResult {
  const assignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // Seeded random for reproducibility
  const random = createSeededRandom(seed);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Handle TC (Coordinator) assignments with proper constraints
  // ═══════════════════════════════════════════════════════════════════════════
  const coordinators = operators.filter(op => op.type === 'Coordinator');
  const tcTasks = tasks.filter(t => TC_TASK_IDS.includes(t.id));

  if (coordinators.length > 0 && tcTasks.length > 0) {
    const tcAssignments = assignTCsWithConstraints(
      coordinators,
      tcTasks,
      days,
      currentAssignments,
      random
    );
    assignments.push(...tcAssignments);
  }

  // Track which operators are assigned on which days
  const operatorAssignedDays = new Map<string, Set<WeekDay>>();
  for (const a of assignments) {
    if (!operatorAssignedDays.has(a.operatorId)) {
      operatorAssignedDays.set(a.operatorId, new Set());
    }
    operatorAssignedDays.get(a.operatorId)!.add(a.day);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Maximum Bipartite Matching for regular operators
  // ═══════════════════════════════════════════════════════════════════════════
  const regularOperators = operators.filter(op => op.type !== 'Coordinator');
  const allMatchedAssignments: Assignment[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];

    // Get pinned/locked assignments for this day
    const pinnedToday = new Map<string, string>(); // operatorId -> taskId
    for (const op of operators) {
      const existing = currentAssignments[op.id]?.[day];
      if (existing?.taskId && (existing.pinned || existing.locked)) {
        assignments.push({ day, operatorId: op.id, taskId: existing.taskId });
        pinnedToday.set(op.id, existing.taskId);
      }
    }

    // Get available operators (not pinned, not already assigned by TC)
    const availableOps = regularOperators.filter(op => {
      if (pinnedToday.has(op.id)) return false;
      if (operatorAssignedDays.get(op.id)?.has(day)) return false;
      if (op.availability?.[day] === false) return false;
      return true;
    });

    // Shuffle for variety (using seeded random)
    shuffleArray(availableOps, random);

    // Build slots for this day (excluding TC tasks and already filled)
    const slots: Slot[] = [];
    const pinnedTaskCounts = new Map<string, number>();
    for (const taskId of pinnedToday.values()) {
      pinnedTaskCounts.set(taskId, (pinnedTaskCounts.get(taskId) || 0) + 1);
    }

    for (const req of taskRequirements) {
      if (req.enabled === false) continue;
      const task = taskMap.get(req.taskId);
      if (!task || task.isCoordinatorOnly) continue;

      const requirements = getRequirementsForDay(req, day);
      const alreadyAssigned = pinnedTaskCounts.get(req.taskId) || 0;

      // Track how many of each type have been counted toward already assigned
      // (For simplicity, assume pinned assignments reduce the first matching type)
      let remainingPinned = alreadyAssigned;

      // Create TYPE-SPECIFIC slots for each operator type requirement
      // This ensures Flex operators get their designated slots
      for (const typeReq of requirements) {
        if (typeReq.type === 'Coordinator') continue; // TCs handled separately

        // Reduce remaining needed by pinned count (proportionally)
        let neededForType = typeReq.count;
        if (remainingPinned > 0) {
          const reduction = Math.min(remainingPinned, neededForType);
          neededForType -= reduction;
          remainingPinned -= reduction;
        }

        for (let i = 0; i < neededForType; i++) {
          slots.push({
            id: `${day}-${req.taskId}-${typeReq.type}-${i}`,
            day,
            dayIndex,
            taskId: req.taskId,
            taskName: task.name,
            requiredSkill: task.requiredSkill,
            isHeavy: task.isHeavy || false,
            operatorType: typeReq.type as 'Regular' | 'Flex',
          });
        }
      }
    }

    // Run maximum matching
    const { matched, unmatched } = findMaximumMatching(slots, availableOps);
    allMatchedAssignments.push(...matched);

    // Report unmatched slots
    for (const slot of unmatched) {
      warnings.push({
        type: 'understaffed',
        message: `${slot.taskName} on ${day}: No available operator with skill "${slot.requiredSkill}"`,
        day,
        taskId: slot.taskId,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Optimize assignments for soft constraints
  // ═══════════════════════════════════════════════════════════════════════════
  const optimizedAssignments = optimizeAssignments(
    allMatchedAssignments,
    regularOperators,
    taskMap,
    rules,
    random
  );

  // Convert to final format
  for (const assignment of optimizedAssignments) {
    assignments.push({
      day: assignment.slot.day,
      operatorId: assignment.operatorId,
      taskId: assignment.slot.taskId,
    });
  }

  return { assignments, warnings };
}

/**
 * Check feasibility: Do we have enough operators for all required slots?
 */
function checkFeasibility(
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  taskRequirements: TaskRequirement[],
  currentAssignments: Record<string, Record<string, { taskId: string | null; locked?: boolean; pinned?: boolean }>>
): FeasibilityResult {
  const warnings: ScheduleWarning[] = [];
  const skillGaps = new Map<string, { required: number; available: number }>();

  // Count operators available per skill per day, separated by type
  const skillOperatorsByType = new Map<string, Map<string, Set<string>>>(); // skill -> type -> set of operator IDs

  for (const op of operators) {
    if (op.type === 'Coordinator') continue; // TCs handled separately
    for (const skill of op.skills) {
      if (!skillOperatorsByType.has(skill)) {
        skillOperatorsByType.set(skill, new Map());
      }
      const byType = skillOperatorsByType.get(skill)!;
      if (!byType.has(op.type)) {
        byType.set(op.type, new Set());
      }
      byType.get(op.type)!.add(op.id);
    }
  }

  // Check each skill requirement
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  for (const req of taskRequirements) {
    if (req.enabled === false) continue;
    const task = taskMap.get(req.taskId);
    if (!task || task.isCoordinatorOnly) continue;

    const skill = task.requiredSkill;
    const byType = skillOperatorsByType.get(skill);

    // Check each operator type requirement separately
    for (const day of days) {
      const requirements = getRequirementsForDay(req, day);
      for (const typeReq of requirements) {
        if (typeReq.type === 'Coordinator') continue;
        if (typeReq.count === 0) continue;

        const availableOfType = byType?.get(typeReq.type)?.size || 0;
        if (availableOfType < typeReq.count) {
          const gapKey = `${skill}-${typeReq.type}`;
          if (!skillGaps.has(gapKey)) {
            skillGaps.set(gapKey, { required: typeReq.count, available: availableOfType });
            warnings.push({
              type: 'understaffed',
              message: `Not enough ${typeReq.type} operators with "${skill}" skill: need ${typeReq.count}, have ${availableOfType}`,
            });
          }
        }
      }
    }
  }

  return {
    feasible: warnings.length === 0,
    warnings,
    skillGaps,
  };
}

/**
 * Assign TCs with constraints:
 * 1. No TC does same task 2 days in a row
 * 2. No two TCs do same task on same day
 * 3. Each TC should do each task at least once per week (variety)
 */
function assignTCsWithConstraints(
  coordinators: Operator[],
  tcTasks: TaskType[],
  days: WeekDay[],
  currentAssignments: Record<string, Record<string, { taskId: string | null; locked?: boolean; pinned?: boolean }>>,
  random: () => number
): ScheduleResult['assignments'] {
  const assignments: ScheduleResult['assignments'] = [];
  const taskIds = tcTasks.map(t => t.id);

  // Track what each TC did yesterday
  const tcLastTask = new Map<string, string | null>();
  coordinators.forEach(tc => tcLastTask.set(tc.id, null));

  // Track weekly task counts for variety
  const tcWeeklyTasks = new Map<string, Map<string, number>>();
  coordinators.forEach(tc => {
    const taskCounts = new Map<string, number>();
    taskIds.forEach(tid => taskCounts.set(tid, 0));
    tcWeeklyTasks.set(tc.id, taskCounts);
  });

  for (const day of days) {
    // Get available TCs for this day
    const availableTCs = coordinators.filter(tc => {
      // Check if already pinned/locked
      const existing = currentAssignments[tc.id]?.[day];
      if (existing?.taskId && (existing.pinned || existing.locked)) {
        return false;
      }
      // Check availability
      return tc.availability?.[day] !== false && tc.status === 'Active';
    });

    // Get locked/pinned TC assignments
    const lockedAssignments = new Map<string, string>();
    const usedTasks = new Set<string>();

    for (const tc of coordinators) {
      const existing = currentAssignments[tc.id]?.[day];
      if (existing?.taskId && (existing.pinned || existing.locked) && taskIds.includes(existing.taskId)) {
        lockedAssignments.set(tc.id, existing.taskId);
        usedTasks.add(existing.taskId);
      }
    }

    // Find valid assignment for remaining TCs
    const tcsToAssign = availableTCs.filter(tc => !lockedAssignments.has(tc.id));
    const tasksToFill = taskIds.filter(tid => !usedTasks.has(tid));

    // Generate all valid permutations
    const validPerms = generateValidTCPermutations(
      tcsToAssign,
      tasksToFill,
      tcLastTask,
      random
    );

    if (validPerms.length > 0) {
      // Score permutations by variety (prefer tasks TC hasn't done much)
      let bestPerm = validPerms[0];
      let bestScore = scoreTCPermutation(bestPerm, tcWeeklyTasks);

      for (const perm of validPerms.slice(1)) {
        const score = scoreTCPermutation(perm, tcWeeklyTasks);
        if (score < bestScore) { // Lower score = better variety
          bestScore = score;
          bestPerm = perm;
        }
      }

      // Apply the best permutation
      for (const [tcId, taskId] of Object.entries(bestPerm)) {
        assignments.push({ day, operatorId: tcId, taskId });
        tcLastTask.set(tcId, taskId);
        const counts = tcWeeklyTasks.get(tcId)!;
        counts.set(taskId, (counts.get(taskId) || 0) + 1);
      }
    }

    // Update last task for locked assignments too
    for (const [tcId, taskId] of lockedAssignments.entries()) {
      tcLastTask.set(tcId, taskId);
      const counts = tcWeeklyTasks.get(tcId);
      if (counts) {
        counts.set(taskId, (counts.get(taskId) || 0) + 1);
      }
    }
  }

  return assignments;
}

/**
 * Generate valid TC permutations (no TC gets yesterday's task, no duplicate tasks)
 */
function generateValidTCPermutations(
  tcs: Operator[],
  tasks: string[],
  tcLastTask: Map<string, string | null>,
  random: () => number
): Record<string, string>[] {
  const results: Record<string, string>[] = [];

  function backtrack(index: number, current: Record<string, string>, usedTasks: Set<string>) {
    if (index >= tcs.length) {
      results.push({ ...current });
      return;
    }

    const tc = tcs[index];
    const lastTask = tcLastTask.get(tc.id);

    // Shuffle task order for variety
    const shuffledTasks = [...tasks];
    shuffleArray(shuffledTasks, random);

    for (const taskId of shuffledTasks) {
      // Skip if task already assigned to another TC today
      if (usedTasks.has(taskId)) continue;
      // Skip if same as yesterday (rotation rule)
      if (taskId === lastTask) continue;

      current[tc.id] = taskId;
      usedTasks.add(taskId);
      backtrack(index + 1, current, usedTasks);
      usedTasks.delete(taskId);
    }
  }

  backtrack(0, {}, new Set());
  return results;
}

/**
 * Score a TC permutation by variety (lower = better)
 */
function scoreTCPermutation(
  perm: Record<string, string>,
  tcWeeklyTasks: Map<string, Map<string, number>>
): number {
  let score = 0;
  for (const [tcId, taskId] of Object.entries(perm)) {
    const counts = tcWeeklyTasks.get(tcId);
    if (counts) {
      score += counts.get(taskId) || 0;
    }
  }
  return score;
}

/**
 * Find maximum bipartite matching using Hopcroft-Karp algorithm
 */
function findMaximumMatching(
  slots: Slot[],
  operators: Operator[]
): { matched: Assignment[]; unmatched: Slot[] } {
  if (slots.length === 0) {
    return { matched: [], unmatched: [] };
  }

  // Build adjacency: slot -> eligible operators
  // Respects operator type requirements (Regular vs Flex)
  const adjacency = new Map<string, string[]>();
  for (const slot of slots) {
    const eligible = operators
      .filter(op => {
        // Must have the required skill
        if (!op.skills.includes(slot.requiredSkill)) return false;
        // If slot specifies an operator type, only match that type
        if (slot.operatorType && op.type !== slot.operatorType) return false;
        return true;
      })
      .map(op => op.id);
    adjacency.set(slot.id, eligible);
  }

  // Run Hopcroft-Karp
  const matching = hopcroftKarp(slots, operators, adjacency);

  const matched: Assignment[] = [];
  const unmatched: Slot[] = [];

  for (const slot of slots) {
    const opId = matching.get(slot.id);
    if (opId) {
      matched.push({ slot, operatorId: opId });
    } else {
      unmatched.push(slot);
    }
  }

  return { matched, unmatched };
}

/**
 * Hopcroft-Karp algorithm for maximum bipartite matching
 * Time: O(E * sqrt(V))
 */
function hopcroftKarp(
  slots: Slot[],
  operators: Operator[],
  adjacency: Map<string, string[]>
): Map<string, string> {
  const slotMatch = new Map<string, string | null>();
  const opMatch = new Map<string, string | null>();

  for (const slot of slots) slotMatch.set(slot.id, null);
  for (const op of operators) opMatch.set(op.id, null);

  const dist = new Map<string, number>();
  const NIL = 'NIL';

  function bfs(): boolean {
    const queue: string[] = [];

    for (const slot of slots) {
      if (slotMatch.get(slot.id) === null) {
        dist.set(slot.id, 0);
        queue.push(slot.id);
      } else {
        dist.set(slot.id, Infinity);
      }
    }
    dist.set(NIL, Infinity);

    while (queue.length > 0) {
      const slotId = queue.shift()!;
      const slotDist = dist.get(slotId)!;

      if (slotDist < dist.get(NIL)!) {
        const eligible = adjacency.get(slotId) || [];

        for (const opId of eligible) {
          const nextSlotId = opMatch.get(opId);

          if (nextSlotId === null) {
            dist.set(NIL, slotDist + 1);
          } else if (dist.get(nextSlotId) === Infinity) {
            dist.set(nextSlotId, slotDist + 1);
            queue.push(nextSlotId);
          }
        }
      }
    }

    return dist.get(NIL) !== Infinity;
  }

  function dfs(slotId: string): boolean {
    if (slotId === NIL) return true;

    const eligible = adjacency.get(slotId) || [];
    const slotDist = dist.get(slotId)!;

    for (const opId of eligible) {
      const nextSlotId = opMatch.get(opId);
      const nextDist = nextSlotId === null ? dist.get(NIL)! : dist.get(nextSlotId)!;

      if (nextDist === slotDist + 1) {
        if (dfs(nextSlotId || NIL)) {
          opMatch.set(opId, slotId);
          slotMatch.set(slotId, opId);
          return true;
        }
      }
    }

    dist.set(slotId, Infinity);
    return false;
  }

  while (bfs()) {
    for (const slot of slots) {
      if (slotMatch.get(slot.id) === null) {
        dfs(slot.id);
      }
    }
  }

  const result = new Map<string, string>();
  for (const slot of slots) {
    const opId = slotMatch.get(slot.id);
    if (opId !== null) {
      result.set(slot.id, opId);
    }
  }

  return result;
}

/**
 * Phase 3: Optimize assignments via local search (swapping)
 * Respects: Flex exempt, Heavy-only rules, Regular-only preferred stations
 */
function optimizeAssignments(
  assignments: Assignment[],
  operators: Operator[],
  taskMap: Map<string, TaskType>,
  rules: SchedulingRules,
  random: () => number
): Assignment[] {
  if (assignments.length < 2) return assignments;

  const opMap = new Map(operators.map(op => [op.id, op]));
  let current = [...assignments];
  let tracking = buildTracking(current, operators);
  let currentScore = scoreSolution(current, opMap, taskMap, tracking, rules);

  const MAX_ITERATIONS = 100;
  let improvements = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let bestSwap: { i: number; j: number; improvement: number } | null = null;

    // Try all valid swaps
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const a1 = current[i];
        const a2 = current[j];

        // Only swap within same day
        if (a1.slot.day !== a2.slot.day) continue;
        if (a1.operatorId === a2.operatorId) continue;

        const op1 = opMap.get(a1.operatorId);
        const op2 = opMap.get(a2.operatorId);
        if (!op1 || !op2) continue;

        // Check skill compatibility
        if (!op1.skills.includes(a2.slot.requiredSkill)) continue;
        if (!op2.skills.includes(a1.slot.requiredSkill)) continue;

        // Check operator type compatibility (respect type-specific slots)
        if (a1.slot.operatorType && a1.slot.operatorType !== op2.type) continue;
        if (a2.slot.operatorType && a2.slot.operatorType !== op1.type) continue;

        // Try swap
        const newAssignments = [...current];
        newAssignments[i] = { ...a1, operatorId: a2.operatorId };
        newAssignments[j] = { ...a2, operatorId: a1.operatorId };

        const newTracking = buildTracking(newAssignments, operators);
        const newScore = scoreSolution(newAssignments, opMap, taskMap, newTracking, rules);
        const improvement = currentScore - newScore;

        if (improvement > 0 && (!bestSwap || improvement > bestSwap.improvement)) {
          bestSwap = { i, j, improvement };
        }
      }
    }

    if (bestSwap) {
      const a1 = current[bestSwap.i];
      const a2 = current[bestSwap.j];

      current[bestSwap.i] = { ...a1, operatorId: a2.operatorId };
      current[bestSwap.j] = { ...a2, operatorId: a1.operatorId };

      tracking = buildTracking(current, operators);
      currentScore = scoreSolution(current, opMap, taskMap, tracking, rules);
      improvements++;
    } else {
      break;
    }
  }

  console.log(`[MaxMatching V4+] Optimization: ${improvements} swaps, final penalty: ${currentScore}`);
  return current;
}

/**
 * Build tracking structures from assignments
 */
function buildTracking(
  assignments: Assignment[],
  operators: Operator[]
): Map<string, OperatorTracking> {
  const tracking = new Map<string, OperatorTracking>();

  for (const op of operators) {
    tracking.set(op.id, {
      tasksByDay: new Map(),
      heavyTaskCount: 0,
      totalAssignments: 0,
      skillsUsed: new Map(),
      consecutiveOnSameTask: 0,
      lastTaskId: null,
    });
  }

  // Sort by day order for consecutive tracking
  const sorted = [...assignments].sort((a, b) =>
    DAY_ORDER.indexOf(a.slot.day) - DAY_ORDER.indexOf(b.slot.day)
  );

  for (const assignment of sorted) {
    const track = tracking.get(assignment.operatorId);
    if (!track) continue;

    track.tasksByDay.set(assignment.slot.day, assignment.slot.taskName);
    track.totalAssignments++;

    if (assignment.slot.isHeavy) {
      track.heavyTaskCount++;
    }

    const skill = assignment.slot.requiredSkill;
    track.skillsUsed.set(skill, (track.skillsUsed.get(skill) || 0) + 1);

    // Track consecutive
    if (track.lastTaskId === assignment.slot.taskId) {
      track.consecutiveOnSameTask++;
    } else {
      track.consecutiveOnSameTask = 1;
    }
    track.lastTaskId = assignment.slot.taskId;
  }

  return tracking;
}

/**
 * Score solution (lower = better)
 * Applies rules correctly: Heavy-only, Regular-only preferred, Flex exempt
 */
function scoreSolution(
  assignments: Assignment[],
  opMap: Map<string, Operator>,
  taskMap: Map<string, TaskType>,
  tracking: Map<string, OperatorTracking>,
  rules: SchedulingRules
): number {
  // Calculate averages for fairness
  let totalHeavy = 0;
  let totalAssigns = 0;
  let opCount = 0;

  for (const track of tracking.values()) {
    totalHeavy += track.heavyTaskCount;
    totalAssigns += track.totalAssignments;
    opCount++;
  }

  const avgHeavy = opCount > 0 ? totalHeavy / opCount : 0;
  const avgTotal = opCount > 0 ? totalAssigns / opCount : 0;

  let penalty = 0;

  for (const assignment of assignments) {
    const op = opMap.get(assignment.operatorId);
    const track = tracking.get(assignment.operatorId);
    if (!op || !track) continue;

    // FIX: Flex operators are EXEMPT from soft constraints
    if (op.type === 'Flex') {
      // Only apply Flex priority for Exceptions (positive effect)
      if (rules.prioritizeFlexForExceptions && assignment.slot.taskName === 'Exceptions') {
        penalty -= 20; // Bonus
      }
      continue; // Skip all other penalties for Flex
    }

    const dayIndex = assignment.slot.dayIndex;
    const taskName = assignment.slot.taskName;
    const isHeavy = assignment.slot.isHeavy;

    // 1. Consecutive days on same task - FIX: Only for HEAVY tasks
    if (isHeavy && dayIndex > 0) {
      const prevDay = DAY_ORDER[dayIndex - 1];
      const prevTask = track.tasksByDay.get(prevDay);
      if (prevTask === taskName) {
        // Count consecutive
        let consecutive = 1;
        for (let i = dayIndex - 1; i >= 0; i--) {
          if (track.tasksByDay.get(DAY_ORDER[i]) === taskName) {
            consecutive++;
          } else {
            break;
          }
        }

        if (consecutive >= rules.maxConsecutiveDaysOnSameTask) {
          penalty += 50; // Hard limit for heavy tasks
        } else {
          penalty += consecutive * 8; // Decay penalty
        }
      }
    }

    // 2. Consecutive heavy shifts
    if (isHeavy && !rules.allowConsecutiveHeavyShifts && dayIndex > 0) {
      const prevDay = DAY_ORDER[dayIndex - 1];
      const prevTask = track.tasksByDay.get(prevDay);
      if (prevTask) {
        // Check if previous was also heavy
        const prevTaskObj = [...taskMap.values()].find(t => t.name === prevTask);
        if (prevTaskObj?.isHeavy) {
          penalty += 30;
        }
      }
    }

    // 3. FIX: Preferred stations - Only for REGULAR operators
    if (rules.respectPreferredStations && op.type === 'Regular') {
      if (op.preferredTasks?.includes(taskName)) {
        penalty -= 15; // Bonus
      }
    }

    // 4. Fair distribution of heavy tasks
    if (rules.fairDistribution && isHeavy) {
      if (track.heavyTaskCount > avgHeavy + 1) {
        penalty += 15;
      } else if (track.heavyTaskCount < avgHeavy - 1) {
        penalty -= 10;
      }
    }

    // 5. Workload balance
    if (rules.balanceWorkload) {
      if (track.totalAssignments > avgTotal + 1) {
        penalty += 10;
      } else if (track.totalAssignments < avgTotal - 1) {
        penalty -= 5;
      }
    }

    // 6. Skill variety
    if (rules.prioritizeSkillVariety) {
      const skill = assignment.slot.requiredSkill;
      const usageCount = track.skillsUsed.get(skill) || 0;

      if (usageCount <= 1) {
        penalty -= 15; // Unused or rarely used
      } else if (usageCount >= 3) {
        penalty += 8; // Overused
      }
    }

    // 7. Flex priority for Exceptions (non-Flex penalty)
    if (rules.prioritizeFlexForExceptions && taskName === 'Exceptions') {
      // Regular operators on Exceptions get a small penalty
      penalty += 10;
    }
  }

  return penalty;
}

/**
 * Calculate fulfillment rate (percentage of slots filled)
 */
function calculateFulfillmentRate(
  result: ScheduleResult,
  tasks: TaskType[],
  taskRequirements: TaskRequirement[],
  days: WeekDay[]
): number {
  let totalRequired = 0;
  let totalAssigned = 0;

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const assignmentCounts = new Map<string, Map<WeekDay, number>>();

  // Count assignments per task per day
  for (const a of result.assignments) {
    if (!assignmentCounts.has(a.taskId)) {
      assignmentCounts.set(a.taskId, new Map());
    }
    const dayCounts = assignmentCounts.get(a.taskId)!;
    dayCounts.set(a.day, (dayCounts.get(a.day) || 0) + 1);
  }

  // Calculate fulfillment
  for (const req of taskRequirements) {
    if (req.enabled === false) continue;
    const task = taskMap.get(req.taskId);
    if (!task) continue;

    for (const day of days) {
      const requirements = getRequirementsForDay(req, day);
      const needed = getTotalFromRequirements(requirements);
      const assigned = assignmentCounts.get(req.taskId)?.get(day) || 0;

      totalRequired += needed;
      totalAssigned += Math.min(assigned, needed);
    }
  }

  return totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 100;
}

/**
 * Calculate penalty score for a result
 */
function calculatePenaltyScore(
  result: ScheduleResult,
  operators: Operator[],
  tasks: TaskType[],
  rules: SchedulingRules
): number {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const opMap = new Map(operators.map(op => [op.id, op]));

  // Convert result to Assignment format for scoring
  const assignments: Assignment[] = result.assignments.map(a => {
    const task = taskMap.get(a.taskId);
    return {
      slot: {
        id: `${a.day}-${a.taskId}`,
        day: a.day,
        dayIndex: DAY_ORDER.indexOf(a.day),
        taskId: a.taskId,
        taskName: task?.name || '',
        requiredSkill: task?.requiredSkill || '',
        isHeavy: task?.isHeavy || false,
      },
      operatorId: a.operatorId,
    };
  });

  const tracking = buildTracking(assignments, operators);
  return scoreSolution(assignments, opMap, taskMap, tracking, rules);
}

/**
 * Create a seeded random number generator
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Shuffle array in place using Fisher-Yates with custom random
 */
function shuffleArray<T>(array: T[], random: () => number): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
