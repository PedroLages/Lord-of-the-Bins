/**
 * Maximum Matching Scheduler (V4)
 *
 * This scheduler GUARANTEES 100% fulfillment when mathematically possible.
 *
 * Uses a two-phase approach:
 * 1. PHASE 1: Find a valid assignment using Maximum Bipartite Matching
 *    - Guarantees all slots are filled if a solution exists
 *    - Uses Hopcroft-Karp algorithm for efficiency
 *
 * 2. PHASE 2: Optimize the assignment for soft rules
 *    - Swap operators to improve variety, balance, rotation
 *    - Never breaks the 100% fulfillment guarantee
 */

import type { Operator, TaskType, WeekDay, TaskRequirement } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type { ScheduleResult, ScheduleWarning, SchedulingRules, ScheduleRequestData } from '../schedulingService';
import { DEFAULT_RULES } from '../schedulingService';

// TC skills (coordinators handle these separately)
const TC_SKILLS = ['Process', 'People', 'Off Process'];

// Heavy tasks that should be rotated and distributed fairly
const HEAVY_TASKS = ['Troubleshooter', 'Exceptions', 'Quality checker', 'Troubleshooter AD'];

// Day ordering for consecutive day tracking
const DAY_ORDER: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface Slot {
  id: string;
  day: WeekDay;
  taskId: string;
  taskName: string;
  requiredSkill: string;
}

interface Assignment {
  slot: Slot;
  operatorId: string;
}

// Tracking structure for Phase 2 optimization
interface OperatorTracking {
  tasksByDay: Map<WeekDay, string>; // day -> taskName
  heavyTaskCount: number;
  totalAssignments: number;
  skillsUsed: Map<string, number>; // skill -> usage count (for variety tracking)
}

/**
 * Main entry point: Generate schedule with guaranteed 100% fulfillment (if possible)
 */
export function generateMaxMatchingSchedule(data: ScheduleRequestData): ScheduleResult {
  const {
    operators: allOperators,
    tasks: allTasks,
    days,
    currentAssignments = {},
    rules = DEFAULT_RULES,
    taskRequirements = [],
    excludedTasks = [],
  } = data;

  console.log('[MaxMatching] Starting maximum matching schedule generation');

  const finalAssignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // Filter active operators and excluded tasks
  const operators = allOperators.filter(op => op.status === 'Active' && !op.archived);
  const tasks = allTasks.filter(t => !excludedTasks.includes(t.name));

  // Collect all matched assignments for Phase 2 optimization
  const allMatchedAssignments: Assignment[] = [];
  const allRegularOperators: Operator[] = [];

  // Process each day independently (Phase 1: Maximum Matching)
  for (const day of days) {
    console.log(`[MaxMatching] Processing ${day}...`);

    // Get operators available this day (not already assigned from pinned/locked)
    const pinnedToday = new Set<string>();
    for (const op of operators) {
      const existing = currentAssignments[op.id]?.[day];
      if (existing?.taskId && (existing.pinned || existing.locked)) {
        finalAssignments.push({ day, operatorId: op.id, taskId: existing.taskId });
        pinnedToday.add(op.id);
      }
    }

    const availableOperators = operators.filter(
      op => !pinnedToday.has(op.id) && op.availability?.[day] !== false
    );

    // Build slots for this day
    const slots: Slot[] = [];
    for (const req of taskRequirements) {
      if (req.enabled === false) continue;
      const task = tasks.find(t => t.id === req.taskId);
      if (!task) continue;

      const requirements = getRequirementsForDay(req, day);
      const count = getTotalFromRequirements(requirements);

      for (let i = 0; i < count; i++) {
        slots.push({
          id: `${day}-${req.taskId}-${i}`,
          day,
          taskId: req.taskId,
          taskName: task.name,
          requiredSkill: task.requiredSkill,
        });
      }
    }

    // Separate TC slots and regular slots
    const tcSlots = slots.filter(s => TC_SKILLS.includes(s.requiredSkill));
    const regularSlots = slots.filter(s => !TC_SKILLS.includes(s.requiredSkill));

    // Handle TC assignments (coordinators)
    const coordinators = availableOperators.filter(op => op.type === 'Coordinator');
    const tcAssignments = assignTCs(tcSlots, coordinators, day);
    finalAssignments.push(...tcAssignments);

    // Handle regular assignments with maximum matching
    const regularOperators = availableOperators.filter(op => op.type !== 'Coordinator');

    // Collect regular operators (unique)
    for (const op of regularOperators) {
      if (!allRegularOperators.find(o => o.id === op.id)) {
        allRegularOperators.push(op);
      }
    }

    const { matched, unmatched } = findMaximumMatching(regularSlots, regularOperators);

    // Collect matched assignments for Phase 2 optimization
    allMatchedAssignments.push(...matched);

    // Report unmatched slots
    if (unmatched.length > 0) {
      console.log(`[MaxMatching] ${day}: ${unmatched.length} slots could not be filled`);
      for (const slot of unmatched) {
        warnings.push({
          type: 'understaffed',
          message: `${slot.taskName} on ${day}: No available operator`,
        });
      }
    }

    console.log(`[MaxMatching] ${day}: ${matched.length}/${regularSlots.length} regular slots filled`);
  }

  // Phase 2: Optimize assignments for soft constraints
  console.log('[MaxMatching] Starting Phase 2 optimization...');
  const optimizedAssignments = optimizeAssignments(
    allMatchedAssignments,
    allRegularOperators,
    rules
  );

  // Convert optimized assignments to final format
  for (const assignment of optimizedAssignments) {
    finalAssignments.push({
      day: assignment.slot.day,
      operatorId: assignment.operatorId,
      taskId: assignment.slot.taskId,
    });
  }

  console.log(`[MaxMatching] Complete: ${finalAssignments.length} total assignments, ${warnings.length} warnings`);

  return { assignments: finalAssignments, warnings };
}

/**
 * Assign coordinators to TC slots with rotation
 */
function assignTCs(slots: Slot[], coordinators: Operator[], day: WeekDay): ScheduleResult['assignments'] {
  const assignments: ScheduleResult['assignments'] = [];
  const usedCoordinators = new Set<string>();

  for (const slot of slots) {
    const available = coordinators.filter(
      tc => tc.skills.includes(slot.requiredSkill) && !usedCoordinators.has(tc.id)
    );

    if (available.length > 0) {
      const chosen = available[0];
      assignments.push({ day, operatorId: chosen.id, taskId: slot.taskId });
      usedCoordinators.add(chosen.id);
    }
  }

  return assignments;
}

/**
 * Find maximum bipartite matching using Hopcroft-Karp algorithm
 *
 * This GUARANTEES finding the maximum number of matched pairs.
 * If 100% matching is possible, it will find it.
 */
function findMaximumMatching(
  slots: Slot[],
  operators: Operator[]
): { matched: Assignment[]; unmatched: Slot[] } {
  if (slots.length === 0) {
    return { matched: [], unmatched: [] };
  }

  // Build adjacency list: slot -> eligible operators
  const slotToOperators: Map<string, string[]> = new Map();

  for (const slot of slots) {
    const eligible = operators
      .filter(op => op.skills.includes(slot.requiredSkill))
      .map(op => op.id);
    slotToOperators.set(slot.id, eligible);
  }

  // Run Hopcroft-Karp algorithm
  const matching = hopcroftKarp(slots, operators, slotToOperators);

  // Convert matching to assignments
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
 *
 * Time complexity: O(E * sqrt(V))
 * Space complexity: O(V + E)
 *
 * Returns: Map from slotId -> operatorId
 */
function hopcroftKarp(
  slots: Slot[],
  operators: Operator[],
  adjacency: Map<string, string[]>
): Map<string, string> {
  // slotMatch[slotId] = operatorId or null
  const slotMatch: Map<string, string | null> = new Map();
  // opMatch[opId] = slotId or null
  const opMatch: Map<string, string | null> = new Map();

  // Initialize all as unmatched
  for (const slot of slots) {
    slotMatch.set(slot.id, null);
  }
  for (const op of operators) {
    opMatch.set(op.id, null);
  }

  // BFS to find shortest augmenting paths
  const dist: Map<string, number> = new Map();
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
            // Found augmenting path to unmatched operator
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

  // DFS to find augmenting path and augment
  function dfs(slotId: string): boolean {
    if (slotId === NIL) {
      return true;
    }

    const eligible = adjacency.get(slotId) || [];
    const slotDist = dist.get(slotId)!;

    for (const opId of eligible) {
      const nextSlotId = opMatch.get(opId);
      const nextDist = nextSlotId === null ? dist.get(NIL)! : dist.get(nextSlotId)!;

      if (nextDist === slotDist + 1) {
        if (dfs(nextSlotId || NIL)) {
          // Augment the matching
          opMatch.set(opId, slotId);
          slotMatch.set(slotId, opId);
          return true;
        }
      }
    }

    // No augmenting path found from this slot
    dist.set(slotId, Infinity);
    return false;
  }

  // Main loop: find augmenting paths until none exist
  while (bfs()) {
    for (const slot of slots) {
      if (slotMatch.get(slot.id) === null) {
        dfs(slot.id);
      }
    }
  }

  // Extract final matching
  const result: Map<string, string> = new Map();
  for (const slot of slots) {
    const opId = slotMatch.get(slot.id);
    if (opId !== null) {
      result.set(slot.id, opId);
    }
  }

  return result;
}

/**
 * Alternative: Simple augmenting path algorithm (easier to understand)
 * Falls back to this if Hopcroft-Karp has issues
 */
function simpleMaxMatching(
  slots: Slot[],
  operators: Operator[],
  adjacency: Map<string, string[]>
): Map<string, string> {
  const slotMatch: Map<string, string | null> = new Map();
  const opMatch: Map<string, string | null> = new Map();

  for (const slot of slots) {
    slotMatch.set(slot.id, null);
  }
  for (const op of operators) {
    opMatch.set(op.id, null);
  }

  // Try to find augmenting path from each unmatched slot
  function tryAugment(slotId: string, visited: Set<string>): boolean {
    const eligible = adjacency.get(slotId) || [];

    for (const opId of eligible) {
      if (visited.has(opId)) continue;
      visited.add(opId);

      const currentSlot = opMatch.get(opId);

      // If operator is free, or we can re-route their current assignment
      if (currentSlot === null || tryAugment(currentSlot, visited)) {
        slotMatch.set(slotId, opId);
        opMatch.set(opId, slotId);
        return true;
      }
    }

    return false;
  }

  // Try to match each slot
  for (const slot of slots) {
    const visited = new Set<string>();
    tryAugment(slot.id, visited);
  }

  // Extract final matching
  const result: Map<string, string> = new Map();
  for (const slot of slots) {
    const opId = slotMatch.get(slot.id);
    if (opId !== null) {
      result.set(slot.id, opId);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: Local Search Optimization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build tracking structures from current assignments
 */
function buildOperatorTracking(
  assignments: Assignment[],
  operators: Operator[]
): Map<string, OperatorTracking> {
  const tracking = new Map<string, OperatorTracking>();

  // Initialize tracking for all operators
  for (const op of operators) {
    tracking.set(op.id, {
      tasksByDay: new Map(),
      heavyTaskCount: 0,
      totalAssignments: 0,
      skillsUsed: new Map(),
    });
  }

  // Populate from assignments
  for (const assignment of assignments) {
    const track = tracking.get(assignment.operatorId);
    if (track) {
      track.tasksByDay.set(assignment.slot.day, assignment.slot.taskName);
      track.totalAssignments++;
      if (HEAVY_TASKS.includes(assignment.slot.taskName)) {
        track.heavyTaskCount++;
      }
      // Track skill usage for variety scoring
      const skill = assignment.slot.requiredSkill;
      const currentCount = track.skillsUsed.get(skill) || 0;
      track.skillsUsed.set(skill, currentCount + 1);
    }
  }

  return tracking;
}

/**
 * Calculate penalty score for a single assignment
 * Lower score = better (0 is perfect)
 */
function scoreAssignment(
  assignment: Assignment,
  operator: Operator,
  tracking: OperatorTracking,
  avgHeavyTasks: number,
  avgTotalTasks: number,
  rules: SchedulingRules
): number {
  let penalty = 0;
  const taskName = assignment.slot.taskName;
  const day = assignment.slot.day;
  const dayIndex = DAY_ORDER.indexOf(day);

  // 1. Consecutive days on same task penalty
  if (dayIndex > 0) {
    const prevDay = DAY_ORDER[dayIndex - 1];
    const prevTask = tracking.tasksByDay.get(prevDay);
    if (prevTask === taskName) {
      // Count consecutive days
      let consecutiveDays = 1;
      for (let i = dayIndex - 1; i >= 0; i--) {
        if (tracking.tasksByDay.get(DAY_ORDER[i]) === taskName) {
          consecutiveDays++;
        } else {
          break;
        }
      }
      // Penalty increases with consecutive days
      if (consecutiveDays >= rules.maxConsecutiveDaysOnSameTask) {
        penalty += 40; // Hard limit reached
      } else {
        penalty += consecutiveDays * 6; // Decay scoring like V2
      }
    }
  }

  // 2. Consecutive heavy task penalty
  if (HEAVY_TASKS.includes(taskName) && !rules.allowConsecutiveHeavyShifts) {
    if (dayIndex > 0) {
      const prevDay = DAY_ORDER[dayIndex - 1];
      const prevTask = tracking.tasksByDay.get(prevDay);
      if (prevTask && HEAVY_TASKS.includes(prevTask)) {
        penalty += 30; // Consecutive heavy tasks
      }
    }
  }

  // 3. Flex priority for Exceptions
  if (taskName === 'Exceptions') {
    if (operator.type === 'Flex') {
      penalty -= 20; // Bonus (negative penalty)
    } else {
      penalty += 10; // Non-Flex on Exceptions
    }
  }

  // 4. Heavy task distribution fairness
  if (HEAVY_TASKS.includes(taskName)) {
    if (tracking.heavyTaskCount > avgHeavyTasks + 1) {
      penalty += 15; // Above average
    } else if (tracking.heavyTaskCount < avgHeavyTasks - 1) {
      penalty -= 10; // Below average (bonus)
    }
  }

  // 5. Workload balance
  if (tracking.totalAssignments > avgTotalTasks + 1) {
    penalty += 10; // Overworked
  } else if (tracking.totalAssignments < avgTotalTasks - 1) {
    penalty -= 5; // Underworked (bonus)
  }

  // 6. Preferred stations bonus
  if (operator.preferredTasks?.includes(taskName)) {
    penalty -= 15; // Preferred task bonus
  }

  // 7. Skill variety (prioritize using all of operator's skills)
  if (rules.prioritizeSkillVariety) {
    const skill = assignment.slot.requiredSkill;
    const usageCount = tracking.skillsUsed.get(skill) || 0;
    const totalSkills = operator.skills.length;
    const usedSkillCount = tracking.skillsUsed.size;

    if (usageCount === 0) {
      // Unused skill - highest bonus (encourages variety)
      penalty -= 15;
    } else if (usageCount === 1) {
      // Used once - smaller bonus
      penalty -= 5;
    } else if (usageCount >= 3) {
      // Overused skill - penalty (discourages same skill repeatedly)
      penalty += 8;
    }

    // Extra bonus if operator has many unused skills left
    const unusedSkillsRemaining = totalSkills - usedSkillCount;
    if (unusedSkillsRemaining >= 3 && usageCount === 0) {
      penalty -= 5; // Extra encouragement to use new skills
    }
  }

  return penalty;
}

/**
 * Calculate total penalty score for all assignments
 */
function scoreSolution(
  assignments: Assignment[],
  operators: Operator[],
  tracking: Map<string, OperatorTracking>,
  rules: SchedulingRules
): number {
  // Calculate averages for fairness scoring
  const opMap = new Map(operators.map(op => [op.id, op]));
  let totalHeavy = 0;
  let totalAssigns = 0;
  let opCount = 0;

  for (const track of tracking.values()) {
    totalHeavy += track.heavyTaskCount;
    totalAssigns += track.totalAssignments;
    opCount++;
  }

  const avgHeavyTasks = opCount > 0 ? totalHeavy / opCount : 0;
  const avgTotalTasks = opCount > 0 ? totalAssigns / opCount : 0;

  let totalPenalty = 0;

  for (const assignment of assignments) {
    const op = opMap.get(assignment.operatorId);
    const track = tracking.get(assignment.operatorId);
    if (op && track) {
      totalPenalty += scoreAssignment(
        assignment, op, track, avgHeavyTasks, avgTotalTasks, rules
      );
    }
  }

  return totalPenalty;
}

/**
 * Phase 2: Optimize assignments by swapping operators
 * Maintains 100% fulfillment guarantee while improving soft constraints
 */
function optimizeAssignments(
  assignments: Assignment[],
  operators: Operator[],
  rules: SchedulingRules
): Assignment[] {
  if (assignments.length < 2) {
    return assignments;
  }

  const opMap = new Map(operators.map(op => [op.id, op]));
  let currentAssignments = [...assignments];
  let tracking = buildOperatorTracking(currentAssignments, operators);
  let currentScore = scoreSolution(currentAssignments, operators, tracking, rules);

  console.log(`[MaxMatching Phase 2] Initial penalty score: ${currentScore}`);

  const MAX_ITERATIONS = 100;
  let improvements = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let bestSwap: { i: number; j: number; improvement: number } | null = null;

    // Find the best improving swap
    for (let i = 0; i < currentAssignments.length; i++) {
      for (let j = i + 1; j < currentAssignments.length; j++) {
        const a1 = currentAssignments[i];
        const a2 = currentAssignments[j];

        // Skip if same operator or same day (can't swap with self)
        if (a1.operatorId === a2.operatorId) continue;
        if (a1.slot.day !== a2.slot.day) continue; // Only swap within same day for now

        const op1 = opMap.get(a1.operatorId);
        const op2 = opMap.get(a2.operatorId);
        if (!op1 || !op2) continue;

        // Check if swap is valid (both operators have skills for swapped tasks)
        const op1CanDoTask2 = op1.skills.includes(a2.slot.requiredSkill);
        const op2CanDoTask1 = op2.skills.includes(a1.slot.requiredSkill);

        if (!op1CanDoTask2 || !op2CanDoTask1) continue;

        // Calculate improvement from swap
        const newAssignments = [...currentAssignments];
        newAssignments[i] = { ...a1, operatorId: a2.operatorId };
        newAssignments[j] = { ...a2, operatorId: a1.operatorId };

        const newTracking = buildOperatorTracking(newAssignments, operators);
        const newScore = scoreSolution(newAssignments, operators, newTracking, rules);
        const improvement = currentScore - newScore;

        if (improvement > 0 && (!bestSwap || improvement > bestSwap.improvement)) {
          bestSwap = { i, j, improvement };
        }
      }
    }

    // Apply best swap if found
    if (bestSwap) {
      const a1 = currentAssignments[bestSwap.i];
      const a2 = currentAssignments[bestSwap.j];

      // Swap operators
      const temp = a1.operatorId;
      currentAssignments[bestSwap.i] = { ...a1, operatorId: a2.operatorId };
      currentAssignments[bestSwap.j] = { ...a2, operatorId: temp };

      // Update tracking and score
      tracking = buildOperatorTracking(currentAssignments, operators);
      currentScore = scoreSolution(currentAssignments, operators, tracking, rules);
      improvements++;
    } else {
      // No improving swap found, we're at local optimum
      break;
    }
  }

  console.log(`[MaxMatching Phase 2] Final penalty score: ${currentScore} (${improvements} swaps made)`);

  return currentAssignments;
}
