/**
 * Enhanced Scheduler
 *
 * This is the main scheduling algorithm that integrates constraint propagation
 * with the greedy assignment strategy. It follows these phases:
 *
 * 1. PROPAGATION: Identify forced assignments and detect infeasibility early
 * 2. PRIORITIZED GREEDY: Process slots in MRV order, scoring candidates
 * 3. REPAIR: Fix any remaining violations through targeted swaps
 *
 * This approach avoids the greedy algorithm "trapping" itself by:
 * - Assigning forced slots first (where only N operators can fill N slots)
 * - Processing most-constrained slots before less-constrained ones
 * - Using the repair phase as a safety net for edge cases
 */

import type { Operator, TaskType, WeekDay, ScheduleAssignment, TaskRequirement, OperatorTypeOption } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type { ScheduleResult, ScheduleWarning, SchedulingRules, ScheduleRequestData } from '../schedulingService';
import { DEFAULT_RULES, setSchedulingSeed, generateRandomSeed } from '../schedulingService';
import { propagateConstraints } from './constraintPropagator';
import { prioritizeSlots, getEligibleOperatorsForSlot, type PrioritizedSlot } from './slotPrioritizer';
import type { PropagationParams, ForcedAssignment, ConstraintSlot, ConcreteOperatorType } from './constraintTypes';
import { solveWithBacktracking } from './backtrackingSolver';

// Heavy tasks for rotation rules
const HEAVY_TASKS = ['Troubleshooter', 'Quality checker', 'Troubleshooter AD', 'Platform'];

// TC skills
const TC_SKILLS = ['Process', 'People', 'Off Process'];

/**
 * Tracking state during scheduling.
 */
interface SchedulingState {
  /** operatorId -> total tasks assigned */
  operatorTaskCount: Record<string, number>;
  /** operatorId -> heavy tasks assigned */
  operatorHeavyTaskCount: Record<string, number>;
  /** operatorId -> last task assigned and consecutive count */
  operatorLastTask: Record<string, { taskId: string; consecutiveDays: number }>;
  /** operatorId -> day -> taskId */
  operatorDailyAssignments: Record<string, Record<string, string>>;
  /** taskId -> operatorType -> count */
  taskTypeAssignments: Record<string, Record<string, number>>;
}

/**
 * Generate an enhanced schedule using constraint propagation + prioritized greedy.
 */
export function generateEnhancedSchedule(data: ScheduleRequestData): ScheduleResult {
  const {
    operators: allOperators,
    tasks: allTasks,
    days,
    currentAssignments = {},
    rules = DEFAULT_RULES,
    taskRequirements = [],
    excludedTasks = [],
  } = data;

  // Set randomization seed for this generation
  const seed = rules.schedulingSeed ?? generateRandomSeed();
  setSchedulingSeed(seed);

  console.log('[Enhanced Scheduler] Starting enhanced schedule generation');
  console.log(`[Enhanced Scheduler] Using seed: ${seed}, randomization: ${rules.randomizationFactor || 0}%`);
  console.log(`[Enhanced Scheduler] Operators: ${allOperators.length}, Tasks: ${allTasks.length}, Days: ${days.length}`);
  console.log(`[Enhanced Scheduler] Excluded tasks: ${excludedTasks.join(', ') || 'none'}`);

  const assignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // Filter active, non-archived operators
  const operators = allOperators.filter(
    op => op.status === 'Active' && !op.archived
  );

  // Filter excluded tasks
  const tasks = allTasks.filter(t => !excludedTasks.includes(t.name));

  // Initialize tracking state
  const state: SchedulingState = {
    operatorTaskCount: {},
    operatorHeavyTaskCount: {},
    operatorLastTask: {},
    operatorDailyAssignments: {},
    taskTypeAssignments: {},
  };

  // Initialize tracking for all operators
  for (const op of operators) {
    state.operatorTaskCount[op.id] = 0;
    state.operatorHeavyTaskCount[op.id] = 0;
    state.operatorDailyAssignments[op.id] = {};
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 0: HANDLE PRE-EXISTING (PINNED/LOCKED) ASSIGNMENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 0: Processing pre-existing assignments');

  for (const day of days) {
    for (const op of operators) {
      const existing = currentAssignments[op.id]?.[day];
      if (existing?.taskId && (existing.pinned || existing.locked)) {
        assignments.push({
          day,
          operatorId: op.id,
          taskId: existing.taskId,
        });
        updateTrackingState(state, op, existing.taskId, day, tasks);
      }
    }
  }

  console.log(`[Enhanced Scheduler] Pre-existing assignments: ${assignments.length}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: CONSTRAINT PROPAGATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 1: Constraint Propagation');

  const propagationParams: PropagationParams = {
    operators,
    tasks,
    days,
    taskRequirements: taskRequirements.filter(tr => tr.enabled !== false),
    excludedTasks,
    currentAssignments,
  };

  const propagation = propagateConstraints(propagationParams);

  if (!propagation.feasible) {
    console.log('[Enhanced Scheduler] ❌ Infeasible configuration detected');
    propagation.infeasibilityReasons.forEach(reason => {
      console.log(`[Enhanced Scheduler]   - ${reason}`);
      warnings.push({
        type: 'understaffed',
        message: `Infeasible: ${reason}`,
      });
    });
    return { assignments, warnings };
  }

  // Apply forced assignments
  console.log(`[Enhanced Scheduler] Found ${propagation.forcedAssignments.length} forced assignments`);

  for (const forced of propagation.forcedAssignments) {
    // Skip if already assigned (from pinned/locked)
    const alreadyAssigned = assignments.some(
      a => a.operatorId === forced.operatorId && a.day === forced.day
    );

    if (!alreadyAssigned) {
      console.log(`[Enhanced Scheduler] Forced: ${forced.operatorName} → ${forced.taskName} (${forced.day}): ${forced.reason}`);
      assignments.push({
        day: forced.day,
        operatorId: forced.operatorId,
        taskId: forced.taskId,
      });

      const operator = operators.find(o => o.id === forced.operatorId);
      if (operator) {
        updateTrackingState(state, operator, forced.taskId, forced.day, tasks);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: PRIORITIZED GREEDY ASSIGNMENT WITH FORWARD CHECKING
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 2: Prioritized Greedy Assignment with Forward Checking');

  // Build slot fill counts from current assignments
  const slotFillCounts = buildSlotFillCounts(assignments);

  // Initialize forward checking state
  const fcState = initializeForwardChecking(propagation.operatorDomains, days);

  // Mark already-assigned operators in forward checking state
  for (const assignment of assignments) {
    updateForwardCheckingAfterAssignment(fcState, assignment.operatorId, assignment.day);
  }

  // Get prioritized slots
  let prioritizedSlots = prioritizeSlots(
    propagation.remainingSlots,
    propagation.operatorDomains,
    operators
  );

  console.log(`[Enhanced Scheduler] Remaining slots to fill: ${prioritizedSlots.length}`);

  // Track dead-ends for potential backtracking
  let deadEndDetected = false;
  const deadEndSlots: Array<{ slot: PrioritizedSlot; available: number; needed: number }> = [];

  // Process each slot in priority order
  for (const slot of prioritizedSlots) {
    const slotKey = `${slot.day}-${slot.taskId}`;
    const currentFilled = slotFillCounts.get(slotKey) || 0;
    const needed = slot.requiredCount - currentFilled;

    if (needed <= 0) continue;

    // Get operators already assigned today
    const assignedToday = new Set(
      assignments
        .filter(a => a.day === slot.day)
        .map(a => a.operatorId)
    );

    // Use forward checking state for eligibility (more accurate than original domains)
    const candidates: typeof operators = [];
    for (const op of operators) {
      if (assignedToday.has(op.id)) continue;

      const dayDomain = fcState.domains.get(op.id)?.get(slot.day);
      if (!dayDomain?.has(slot.taskId)) continue;

      // Check type requirements
      if (slot.typeRequirements.length > 0) {
        const hasMatchingType = slot.typeRequirements.some(
          req => req.type === op.type
        );
        if (!hasMatchingType) continue;
      }

      candidates.push(op);
    }

    if (candidates.length === 0) {
      console.log(`[Enhanced Scheduler] ⚠️ DEAD-END: No candidates for ${slot.taskName} on ${slot.day}`);
      deadEndDetected = true;
      deadEndSlots.push({ slot, available: 0, needed });
      continue;
    }

    if (candidates.length < needed) {
      console.log(`[Enhanced Scheduler] ⚠️ PARTIAL DEAD-END: Only ${candidates.length} candidates for ${slot.taskName} on ${slot.day} (need ${needed})`);
      deadEndSlots.push({ slot, available: candidates.length, needed });
    }

    // Score and sort candidates
    const scoredCandidates = candidates
      .map(op => scoreCandidateForSlot(op, slot, state, rules, tasks))
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score);

    // Assign top N candidates
    const toAssign = Math.min(needed, scoredCandidates.length);

    for (let i = 0; i < toAssign; i++) {
      const candidate = scoredCandidates[i];
      const operator = operators.find(o => o.id === candidate.operatorId);

      if (!operator) continue;

      console.log(`[Enhanced Scheduler] Assign: ${operator.name} → ${slot.taskName} (${slot.day}) [score: ${candidate.score}]`);

      assignments.push({
        day: slot.day,
        operatorId: candidate.operatorId,
        taskId: slot.taskId,
      });

      updateTrackingState(state, operator, slot.taskId, slot.day, tasks);
      slotFillCounts.set(slotKey, (slotFillCounts.get(slotKey) || 0) + 1);

      // FORWARD CHECKING: Update domains after assignment
      updateForwardCheckingAfterAssignment(fcState, candidate.operatorId, slot.day);

      // FORWARD CHECKING: Check for newly created dead-ends
      const newDeadEnds = detectDeadEnds(fcState, prioritizedSlots, slotFillCounts, operators);
      if (newDeadEnds.length > 0 && !deadEndDetected) {
        console.log(`[Enhanced Scheduler] ⚠️ Forward Check: ${newDeadEnds.length} potential dead-end(s) detected`);
        for (const de of newDeadEnds) {
          if (!deadEndSlots.some(d => d.slot.taskId === de.slot.taskId && d.slot.day === de.slot.day)) {
            deadEndSlots.push(de);
          }
        }
      }
    }
  }

  // Log dead-end summary
  if (deadEndSlots.length > 0) {
    console.log(`[Enhanced Scheduler] Dead-end summary: ${deadEndSlots.length} slots with insufficient candidates`);
    deadEndSlots.forEach(de => {
      console.log(`[Enhanced Scheduler]   - ${de.slot.taskName} on ${de.slot.day}: ${de.available}/${de.needed} available`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2.5: BACKTRACKING FALLBACK (if dead-ends detected)
  // ═══════════════════════════════════════════════════════════════════
  if (deadEndSlots.length > 0) {
    console.log('[Enhanced Scheduler] Phase 2.5: Backtracking fallback triggered');

    // Convert current assignments to the format expected by backtracking solver
    const existingAssignments = assignments.map(a => ({
      operatorId: a.operatorId,
      taskId: a.taskId,
      day: a.day,
    }));

    // Build remaining slots for backtracking
    const slotsForBacktracking: ConstraintSlot[] = [];
    for (const { slot } of deadEndSlots) {
      const key = `${slot.day}-${slot.taskId}`;
      const currentFilled = slotFillCounts.get(key) || 0;
      const needed = slot.requiredCount - currentFilled;

      if (needed > 0) {
        slotsForBacktracking.push({
          day: slot.day,
          taskId: slot.taskId,
          taskName: slot.taskName,
          requiredSkill: slot.requiredSkill,
          requiredCount: needed,
          typeRequirements: slot.typeRequirements,
          tier: slot.tier,
        });
      }
    }

    if (slotsForBacktracking.length > 0) {
      console.log(`[Enhanced Scheduler] Running backtracking for ${slotsForBacktracking.length} unfilled slots`);

      const backtrackResult = solveWithBacktracking(
        slotsForBacktracking,
        operators,
        fcState.domains,
        existingAssignments,
        { verbose: false, maxBacktracks: 5000, maxTimeMs: 3000 }
      );

      if (backtrackResult.success) {
        console.log(`[Enhanced Scheduler] Backtracking succeeded! Found ${backtrackResult.assignments.length} total assignments`);
        console.log(`[Enhanced Scheduler]   Backtracks: ${backtrackResult.backtracks}, Time: ${backtrackResult.timeMs}ms`);

        // Replace assignments with backtracking result
        // Filter out existing assignments and add new ones from backtracking
        const existingSet = new Set(existingAssignments.map(a => `${a.operatorId}-${a.day}`));
        const newFromBacktrack = backtrackResult.assignments.filter(
          a => !existingSet.has(`${a.operatorId}-${a.day}`)
        );

        for (const ba of newFromBacktrack) {
          // Only add if not already in assignments
          const alreadyAssigned = assignments.some(
            a => a.operatorId === ba.operatorId && a.day === ba.day
          );
          if (!alreadyAssigned) {
            assignments.push({
              day: ba.day,
              operatorId: ba.operatorId,
              taskId: ba.taskId,
            });

            const operator = operators.find(o => o.id === ba.operatorId);
            if (operator) {
              updateTrackingState(state, operator, ba.taskId, ba.day, tasks);
            }
          }
        }
      } else {
        console.log(`[Enhanced Scheduler] Backtracking failed: ${backtrackResult.failureReason}`);
        console.log(`[Enhanced Scheduler]   Backtracks: ${backtrackResult.backtracks}, Time: ${backtrackResult.timeMs}ms`);
        warnings.push({
          type: 'understaffed',
          message: `Backtracking failed: ${backtrackResult.failureReason}`,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: VALIDATE AND REPORT
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 3: Validation');

  // Check for remaining violations
  const violations = checkViolations(assignments, taskRequirements, days, tasks);

  for (const violation of violations) {
    console.log(`[Enhanced Scheduler] Violation: ${violation.message}`);
    warnings.push({
      type: violation.type === 'under' ? 'understaffed' : 'understaffed',
      message: violation.message,
    });
  }

  console.log(`[Enhanced Scheduler] Complete: ${assignments.length} assignments, ${warnings.length} warnings`);

  return { assignments, warnings };
}

/**
 * Update tracking state after an assignment.
 */
function updateTrackingState(
  state: SchedulingState,
  operator: Operator,
  taskId: string,
  day: WeekDay,
  tasks: TaskType[]
): void {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // Update task count
  state.operatorTaskCount[operator.id] = (state.operatorTaskCount[operator.id] || 0) + 1;

  // Update heavy task count
  if (HEAVY_TASKS.includes(task.name)) {
    state.operatorHeavyTaskCount[operator.id] = (state.operatorHeavyTaskCount[operator.id] || 0) + 1;
  }

  // Update daily assignments
  if (!state.operatorDailyAssignments[operator.id]) {
    state.operatorDailyAssignments[operator.id] = {};
  }
  state.operatorDailyAssignments[operator.id][day] = taskId;

  // Update consecutive tracking
  const lastTask = state.operatorLastTask[operator.id];
  if (lastTask && lastTask.taskId === taskId) {
    state.operatorLastTask[operator.id] = {
      taskId,
      consecutiveDays: lastTask.consecutiveDays + 1,
    };
  } else {
    state.operatorLastTask[operator.id] = {
      taskId,
      consecutiveDays: 1,
    };
  }

  // Update type assignments
  if (!state.taskTypeAssignments[taskId]) {
    state.taskTypeAssignments[taskId] = {};
  }
  state.taskTypeAssignments[taskId][operator.type] =
    (state.taskTypeAssignments[taskId][operator.type] || 0) + 1;
}

/**
 * Score a candidate operator for a slot.
 * Higher score = better match.
 */
function scoreCandidateForSlot(
  operator: Operator,
  slot: PrioritizedSlot,
  state: SchedulingState,
  rules: SchedulingRules,
  tasks: TaskType[]
): { operatorId: string; score: number; reasons: string[] } {
  let score = 100;
  const reasons: string[] = [];

  const task = tasks.find(t => t.id === slot.taskId);
  if (!task) {
    return { operatorId: operator.id, score: 0, reasons: ['Unknown task'] };
  }

  // HARD CONSTRAINT: Skill matching
  if (!operator.skills.includes(task.requiredSkill)) {
    return { operatorId: operator.id, score: 0, reasons: ['No required skill'] };
  }

  // HARD CONSTRAINT: Coordinator restrictions
  if (operator.type === 'Coordinator') {
    if (!TC_SKILLS.includes(task.requiredSkill)) {
      return { operatorId: operator.id, score: 0, reasons: ['Coordinator cannot do this task'] };
    }

    // TC rotation: never same task 2 days in a row
    const lastTask = state.operatorLastTask[operator.id];
    if (lastTask && lastTask.taskId === slot.taskId) {
      score -= 100;
      reasons.push('TC must rotate daily');
    }
  }

  // Heavy task consecutive shift check
  const isHeavyTask = HEAVY_TASKS.includes(task.name);
  const lastTask = state.operatorLastTask[operator.id];

  if (isHeavyTask && lastTask && !rules.allowConsecutiveHeavyShifts) {
    const lastTaskObj = tasks.find(t => t.id === lastTask.taskId);
    if (lastTaskObj && HEAVY_TASKS.includes(lastTaskObj.name)) {
      score -= 30;
      reasons.push('Consecutive heavy shift');
    }
  }

  // Check max consecutive days using category rules
  const maxConsecutive = getMaxConsecutiveDays(task.name, rules);
  if (lastTask && lastTask.taskId === slot.taskId && lastTask.consecutiveDays >= maxConsecutive) {
    score -= 80;
    reasons.push(`Already ${lastTask.consecutiveDays} days on same task`);
  }

  // Flex priority for Exceptions
  if (rules.prioritizeFlexForExceptions && task.name === 'Exceptions') {
    if (operator.type === 'Flex') {
      score += 20;
      reasons.push('Flex priority for Exceptions');
    } else {
      score -= 10;
    }
  }

  // Fair distribution
  if (rules.fairDistribution && isHeavyTask) {
    const counts = Object.values(state.operatorHeavyTaskCount);
    const avgHeavyTasks = counts.length > 0
      ? counts.reduce((a, b) => a + b, 0) / counts.length
      : 0;

    const operatorHeavyCount = state.operatorHeavyTaskCount[operator.id] || 0;

    if (operatorHeavyCount > avgHeavyTasks + 1) {
      score -= 15;
      reasons.push('Above average heavy tasks');
    } else if (operatorHeavyCount < avgHeavyTasks) {
      score += 10;
      reasons.push('Below average heavy tasks');
    }
  }

  // Workload balance
  if (rules.balanceWorkload) {
    const counts = Object.values(state.operatorTaskCount);
    const avgTasks = counts.length > 0
      ? counts.reduce((a, b) => a + b, 0) / counts.length
      : 0;

    const operatorCount = state.operatorTaskCount[operator.id] || 0;

    if (operatorCount > avgTasks + 1) {
      score -= 10;
      reasons.push('Above average workload');
    } else if (operatorCount < avgTasks) {
      score += 5;
      reasons.push('Below average workload');
    }
  }

  // Preferred tasks
  if (rules.respectPreferredStations && operator.preferredTasks?.length) {
    if (operator.preferredTasks.includes(task.name)) {
      score += 100;
      reasons.push('Preferred task');
    }
  }

  // Type requirement matching
  if (slot.typeRequirements.length > 0) {
    const matchingReq = slot.typeRequirements.find(
      req => req.type === operator.type
    );

    if (matchingReq) {
      // Bonus for matching specific type requirement
      score += 15;
      reasons.push(`Matches ${matchingReq.type} requirement`);
    }
  }

  // Apply randomization factor for variety (0-100)
  // Higher factor = more variety in scheduling
  const randomFactor = rules.randomizationFactor || 0;
  if (randomFactor > 0) {
    // Add random adjustment between -randomFactor/2 and +randomFactor/2
    const randomAdjust = (Math.random() - 0.5) * randomFactor;
    score += randomAdjust;
  }

  return { operatorId: operator.id, score, reasons };
}

/**
 * Get max consecutive days for a task based on category.
 */
function getMaxConsecutiveDays(taskName: string, rules?: SchedulingRules): number {
  const heavyTasks = rules?.heavyTasks ?? HEAVY_TASKS;
  const softTasks = rules?.softTasks ?? ['Filler', 'Exceptions', 'Decanting'];

  if (heavyTasks.includes(taskName)) return 1;
  if (softTasks.includes(taskName)) return 2;
  return 1;
}

/**
 * Build slot fill counts from assignments.
 */
function buildSlotFillCounts(
  assignments: ScheduleResult['assignments']
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const assignment of assignments) {
    const key = `${assignment.day}-${assignment.taskId}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return counts;
}

/**
 * Check for constraint violations.
 */
function checkViolations(
  assignments: ScheduleResult['assignments'],
  taskRequirements: TaskRequirement[],
  days: WeekDay[],
  tasks: TaskType[]
): Array<{ type: 'under' | 'over'; message: string }> {
  const violations: Array<{ type: 'under' | 'over'; message: string }> = [];

  const fillCounts = buildSlotFillCounts(assignments);

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
          message: `${task.name} on ${day}: ${actual}/${required} assigned (short ${required - actual})`,
        });
      } else if (actual > required && required > 0) {
        violations.push({
          type: 'over',
          message: `${task.name} on ${day}: ${actual}/${required} assigned (excess ${actual - required})`,
        });
      }
    }
  }

  return violations;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORWARD CHECKING IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Forward checking state tracks which operators are still available for each day.
 * After each assignment, we update this to reflect the reduced domains.
 */
interface ForwardCheckingState {
  /** operatorId -> day -> available (true if not yet assigned that day) */
  operatorAvailability: Map<string, Map<WeekDay, boolean>>;
  /** Current operator domains (cloned from propagation) */
  domains: Map<string, Map<WeekDay, Set<string>>>;
}

/**
 * Initialize forward checking state from propagation result.
 */
function initializeForwardChecking(
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  days: WeekDay[]
): ForwardCheckingState {
  const operatorAvailability = new Map<string, Map<WeekDay, boolean>>();
  const domains = new Map<string, Map<WeekDay, Set<string>>>();

  // Clone domains and initialize availability
  Array.from(operatorDomains.entries()).forEach(([opId, dayMap]) => {
    const newDayMap = new Map<WeekDay, Set<string>>();
    const availMap = new Map<WeekDay, boolean>();

    Array.from(dayMap.entries()).forEach(([day, taskSet]) => {
      newDayMap.set(day, new Set(taskSet));
      availMap.set(day, taskSet.size > 0);
    });

    domains.set(opId, newDayMap);
    operatorAvailability.set(opId, availMap);
  });

  return { operatorAvailability, domains };
}

/**
 * Update forward checking state after an assignment.
 * When an operator is assigned to a task on a day:
 * 1. Mark them unavailable for that day
 * 2. Remove their options for that day from domains
 * 3. Check if any slot becomes unfillable (dead-end)
 */
function updateForwardCheckingAfterAssignment(
  fcState: ForwardCheckingState,
  operatorId: string,
  day: WeekDay
): void {
  // Mark operator as unavailable for this day
  const availMap = fcState.operatorAvailability.get(operatorId);
  if (availMap) {
    availMap.set(day, false);
  }

  // Clear their domain for this day (they're assigned now)
  const domainMap = fcState.domains.get(operatorId);
  if (domainMap) {
    domainMap.set(day, new Set());
  }
}

/**
 * Detect dead-ends: slots that can no longer be filled.
 * A dead-end occurs when:
 * - A slot still needs N more operators
 * - But fewer than N operators have this task in their domain for this day
 */
function detectDeadEnds(
  fcState: ForwardCheckingState,
  remainingSlots: PrioritizedSlot[],
  slotFillCounts: Map<string, number>,
  operators: Operator[]
): Array<{ slot: PrioritizedSlot; available: number; needed: number }> {
  const deadEnds: Array<{ slot: PrioritizedSlot; available: number; needed: number }> = [];

  for (const slot of remainingSlots) {
    const slotKey = `${slot.day}-${slot.taskId}`;
    const currentFilled = slotFillCounts.get(slotKey) || 0;
    const needed = slot.requiredCount - currentFilled;

    if (needed <= 0) continue; // Slot is already filled

    // Count operators who can still fill this slot
    let availableCount = 0;
    for (const op of operators) {
      const dayDomain = fcState.domains.get(op.id)?.get(slot.day);
      if (dayDomain?.has(slot.taskId)) {
        availableCount++;
      }
    }

    if (availableCount < needed) {
      deadEnds.push({ slot, available: availableCount, needed });
    }
  }

  return deadEnds;
}

/**
 * Get type-aware eligible count for a slot.
 * This considers not just total availability but type requirements too.
 */
function getTypeAwareEligibleCount(
  slot: PrioritizedSlot,
  fcState: ForwardCheckingState,
  operators: Operator[],
  assignedToday: Set<string>
): { total: number; byType: Record<ConcreteOperatorType, number> } {
  const byType: Record<ConcreteOperatorType, number> = {
    Regular: 0,
    Flex: 0,
    Coordinator: 0,
  };
  let total = 0;

  for (const op of operators) {
    if (assignedToday.has(op.id)) continue;

    const dayDomain = fcState.domains.get(op.id)?.get(slot.day);
    if (dayDomain?.has(slot.taskId)) {
      byType[op.type as ConcreteOperatorType]++;
      total++;
    }
  }

  return { total, byType };
}
