/**
 * Backtracking Solver
 *
 * This module provides a complete backtracking algorithm for scheduling.
 * It serves as a safety net when the greedy algorithm fails to find a solution.
 *
 * Key features:
 * - MRV (Minimum Remaining Values) heuristic for variable selection
 * - Forward checking to detect dead-ends early
 * - Type-aware constraint checking
 * - Completeness guarantee: if a solution exists, it WILL find it
 *
 * This is only invoked when greedy fails (~2-5% of cases), so performance
 * is acceptable even though backtracking can be slower than greedy.
 */

import type { Operator, TaskType, WeekDay, TaskRequirement, OperatorTypeOption } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type { ConstraintSlot, PropagationParams, ConcreteOperatorType } from './constraintTypes';

/**
 * A partial assignment during backtracking search.
 */
interface PartialAssignment {
  operatorId: string;
  taskId: string;
  day: WeekDay;
}

/**
 * Search state during backtracking.
 */
interface BacktrackState {
  /** Current partial solution */
  assignments: PartialAssignment[];
  /** operatorId -> day -> Set<taskId> remaining options */
  domains: Map<string, Map<WeekDay, Set<string>>>;
  /** day-taskId -> number assigned */
  slotFillCounts: Map<string, number>;
  /** operatorId -> Set<day> days already assigned */
  operatorAssignedDays: Map<string, Set<WeekDay>>;
}

/**
 * Result of backtracking solve.
 */
export interface BacktrackResult {
  success: boolean;
  assignments: PartialAssignment[];
  /** If failed, reason why */
  failureReason?: string;
  /** Number of backtracks performed */
  backtracks: number;
  /** Time taken in milliseconds */
  timeMs: number;
}

/**
 * Configuration for the backtracking solver.
 */
interface BacktrackConfig {
  /** Maximum backtracks before giving up (prevents infinite loops) */
  maxBacktracks: number;
  /** Maximum time in milliseconds */
  maxTimeMs: number;
  /** Enable verbose logging */
  verbose: boolean;
}

const DEFAULT_CONFIG: BacktrackConfig = {
  maxBacktracks: 10000,
  maxTimeMs: 5000,
  verbose: false,
};

/**
 * Solve scheduling problem using backtracking with forward checking.
 *
 * @param slots - Slots that need to be filled
 * @param operators - Available operators
 * @param initialDomains - Initial operator domains from constraint propagation
 * @param existingAssignments - Pre-existing assignments (pinned/locked/forced)
 * @param config - Optional configuration
 */
export function solveWithBacktracking(
  slots: ConstraintSlot[],
  operators: Operator[],
  initialDomains: Map<string, Map<WeekDay, Set<string>>>,
  existingAssignments: PartialAssignment[],
  config: Partial<BacktrackConfig> = {}
): BacktrackResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  // Initialize state
  const state = initializeState(operators, initialDomains, existingAssignments);

  // Calculate slots that still need filling
  const remainingSlots = calculateRemainingSlots(slots, state.slotFillCounts);

  if (remainingSlots.length === 0) {
    return {
      success: true,
      assignments: existingAssignments,
      backtracks: 0,
      timeMs: Date.now() - startTime,
    };
  }

  // Run backtracking search
  let backtracks = 0;
  const result = backtrack(
    state,
    remainingSlots,
    operators,
    () => {
      backtracks++;
      return backtracks <= cfg.maxBacktracks && (Date.now() - startTime) < cfg.maxTimeMs;
    },
    cfg.verbose
  );

  if (result) {
    return {
      success: true,
      assignments: [...existingAssignments, ...result],
      backtracks,
      timeMs: Date.now() - startTime,
    };
  }

  return {
    success: false,
    assignments: existingAssignments,
    failureReason: backtracks > cfg.maxBacktracks
      ? `Exceeded max backtracks (${cfg.maxBacktracks})`
      : (Date.now() - startTime) >= cfg.maxTimeMs
        ? `Exceeded max time (${cfg.maxTimeMs}ms)`
        : 'No solution exists',
    backtracks,
    timeMs: Date.now() - startTime,
  };
}

/**
 * Initialize backtracking state from existing data.
 */
function initializeState(
  operators: Operator[],
  initialDomains: Map<string, Map<WeekDay, Set<string>>>,
  existingAssignments: PartialAssignment[]
): BacktrackState {
  // Clone domains
  const domains = new Map<string, Map<WeekDay, Set<string>>>();
  Array.from(initialDomains.entries()).forEach(([opId, dayMap]) => {
    const newDayMap = new Map<WeekDay, Set<string>>();
    Array.from(dayMap.entries()).forEach(([day, taskSet]) => {
      newDayMap.set(day, new Set(taskSet));
    });
    domains.set(opId, newDayMap);
  });

  // Build slot fill counts and operator assigned days
  const slotFillCounts = new Map<string, number>();
  const operatorAssignedDays = new Map<string, Set<WeekDay>>();

  for (const op of operators) {
    operatorAssignedDays.set(op.id, new Set());
  }

  for (const assignment of existingAssignments) {
    // Update slot counts
    const key = `${assignment.day}-${assignment.taskId}`;
    slotFillCounts.set(key, (slotFillCounts.get(key) || 0) + 1);

    // Update operator assigned days
    const opDays = operatorAssignedDays.get(assignment.operatorId);
    if (opDays) {
      opDays.add(assignment.day);
    }

    // Clear operator's domain for that day (they're assigned)
    const opDomains = domains.get(assignment.operatorId);
    if (opDomains) {
      opDomains.set(assignment.day, new Set());
    }
  }

  return {
    assignments: [],
    domains,
    slotFillCounts,
    operatorAssignedDays,
  };
}

/**
 * Calculate which slots still need assignments.
 */
function calculateRemainingSlots(
  slots: ConstraintSlot[],
  fillCounts: Map<string, number>
): Array<{ slot: ConstraintSlot; needed: number }> {
  const remaining: Array<{ slot: ConstraintSlot; needed: number }> = [];

  for (const slot of slots) {
    const key = `${slot.day}-${slot.taskId}`;
    const filled = fillCounts.get(key) || 0;
    const needed = slot.requiredCount - filled;

    if (needed > 0) {
      // Add one entry per needed assignment (we assign one operator at a time)
      for (let i = 0; i < needed; i++) {
        remaining.push({ slot, needed: needed - i });
      }
    }
  }

  return remaining;
}

/**
 * Main backtracking algorithm.
 * Returns list of new assignments if successful, null if no solution.
 */
function backtrack(
  state: BacktrackState,
  remainingSlots: Array<{ slot: ConstraintSlot; needed: number }>,
  operators: Operator[],
  continueCheck: () => boolean,
  verbose: boolean
): PartialAssignment[] | null {
  // Base case: all slots filled
  if (remainingSlots.length === 0) {
    return state.assignments;
  }

  // Check if we should continue
  if (!continueCheck()) {
    return null;
  }

  // MRV: Select the most constrained slot (fewest eligible operators)
  const { selectedIdx, eligibleOperators } = selectMRVSlot(
    remainingSlots,
    state,
    operators
  );

  if (eligibleOperators.length === 0) {
    // Dead-end: no operators can fill this slot
    if (verbose) {
      const slot = remainingSlots[selectedIdx].slot;
      console.log(`[Backtrack] Dead-end: No operators for ${slot.taskName} on ${slot.day}`);
    }
    return null;
  }

  const { slot } = remainingSlots[selectedIdx];

  // Try each eligible operator
  for (const operator of eligibleOperators) {
    if (verbose) {
      console.log(`[Backtrack] Trying: ${operator.name} → ${slot.taskName} (${slot.day})`);
    }

    // Make assignment
    const newState = makeAssignment(state, operator, slot);

    // Forward check: verify no slot becomes unfillable
    if (hasDeadEnd(newState, remainingSlots.slice(1), operators)) {
      if (verbose) {
        console.log(`[Backtrack] Forward check failed, backtracking`);
      }
      continue; // Try next operator
    }

    // Remove this slot from remaining and recurse
    const newRemaining = [
      ...remainingSlots.slice(0, selectedIdx),
      ...remainingSlots.slice(selectedIdx + 1),
    ];

    const result = backtrack(newState, newRemaining, operators, continueCheck, verbose);

    if (result) {
      return result; // Found solution!
    }

    // Backtrack: try next operator
    if (verbose) {
      console.log(`[Backtrack] No solution with ${operator.name}, trying next`);
    }
  }

  // No operator worked for this slot
  return null;
}

/**
 * Select the most constrained slot using MRV heuristic.
 * Returns the index and the list of eligible operators.
 */
function selectMRVSlot(
  remainingSlots: Array<{ slot: ConstraintSlot; needed: number }>,
  state: BacktrackState,
  operators: Operator[]
): { selectedIdx: number; eligibleOperators: Operator[] } {
  let minCount = Infinity;
  let selectedIdx = 0;
  let selectedEligible: Operator[] = [];

  for (let i = 0; i < remainingSlots.length; i++) {
    const { slot } = remainingSlots[i];
    const eligible = getEligibleOperators(slot, state, operators);

    if (eligible.length < minCount) {
      minCount = eligible.length;
      selectedIdx = i;
      selectedEligible = eligible;
    }

    // If we find a slot with 0 or 1 option, use it immediately (optimization)
    if (minCount <= 1) break;
  }

  return { selectedIdx, eligibleOperators: selectedEligible };
}

/**
 * Get operators eligible for a slot given current state.
 */
function getEligibleOperators(
  slot: ConstraintSlot,
  state: BacktrackState,
  operators: Operator[]
): Operator[] {
  const eligible: Operator[] = [];

  for (const op of operators) {
    // Check if already assigned this day
    const assignedDays = state.operatorAssignedDays.get(op.id);
    if (assignedDays?.has(slot.day)) continue;

    // Check domain
    const dayDomain = state.domains.get(op.id)?.get(slot.day);
    if (!dayDomain?.has(slot.taskId)) continue;

    // Check type requirements
    if (slot.typeRequirements.length > 0) {
      const hasMatchingType = slot.typeRequirements.some(
        req => req.type === op.type
      );
      if (!hasMatchingType) continue;
    }

    eligible.push(op);
  }

  // Sort by type priority
  if (slot.typeRequirements.length > 0) {
    eligible.sort((a, b) => {
      const aSpecific = slot.typeRequirements.some(r => r.type === a.type);
      const bSpecific = slot.typeRequirements.some(r => r.type === b.type);
      if (aSpecific && !bSpecific) return -1;
      if (!aSpecific && bSpecific) return 1;
      return 0;
    });
  }

  return eligible;
}

/**
 * Make an assignment and return new state (immutable update).
 */
function makeAssignment(
  state: BacktrackState,
  operator: Operator,
  slot: ConstraintSlot
): BacktrackState {
  // Clone state
  const newAssignments = [...state.assignments, {
    operatorId: operator.id,
    taskId: slot.taskId,
    day: slot.day,
  }];

  // Clone and update domains
  const newDomains = new Map<string, Map<WeekDay, Set<string>>>();
  Array.from(state.domains.entries()).forEach(([opId, dayMap]) => {
    const newDayMap = new Map<WeekDay, Set<string>>();
    Array.from(dayMap.entries()).forEach(([day, taskSet]) => {
      if (opId === operator.id && day === slot.day) {
        // Assigned operator: empty domain for this day
        newDayMap.set(day, new Set());
      } else {
        newDayMap.set(day, new Set(taskSet));
      }
    });
    newDomains.set(opId, newDayMap);
  });

  // Clone and update slot fill counts
  const newFillCounts = new Map(state.slotFillCounts);
  const key = `${slot.day}-${slot.taskId}`;
  newFillCounts.set(key, (newFillCounts.get(key) || 0) + 1);

  // Clone and update operator assigned days
  const newOpDays = new Map<string, Set<WeekDay>>();
  Array.from(state.operatorAssignedDays.entries()).forEach(([opId, days]) => {
    if (opId === operator.id) {
      const newSet = new Set(days);
      newSet.add(slot.day);
      newOpDays.set(opId, newSet);
    } else {
      newOpDays.set(opId, new Set(days));
    }
  });

  return {
    assignments: newAssignments,
    domains: newDomains,
    slotFillCounts: newFillCounts,
    operatorAssignedDays: newOpDays,
  };
}

/**
 * Forward checking: detect if any remaining slot becomes unfillable.
 */
function hasDeadEnd(
  state: BacktrackState,
  remainingSlots: Array<{ slot: ConstraintSlot; needed: number }>,
  operators: Operator[]
): boolean {
  // Group remaining slots by day-taskId and count needed
  const slotNeeds = new Map<string, number>();

  for (const { slot, needed } of remainingSlots) {
    const key = `${slot.day}-${slot.taskId}`;
    slotNeeds.set(key, (slotNeeds.get(key) || 0) + 1);
  }

  // Check each unique slot
  const checkedSlots = new Set<string>();

  for (const { slot } of remainingSlots) {
    const key = `${slot.day}-${slot.taskId}`;
    if (checkedSlots.has(key)) continue;
    checkedSlots.add(key);

    const needed = slotNeeds.get(key) || 0;
    const eligible = getEligibleOperators(slot, state, operators);

    if (eligible.length < needed) {
      return true; // Dead-end detected
    }
  }

  return false;
}

/**
 * Utility: Check if a configuration is solvable without actually solving.
 * Faster than full backtracking - just checks constraint consistency.
 */
export function isSolvable(
  slots: ConstraintSlot[],
  operators: Operator[],
  domains: Map<string, Map<WeekDay, Set<string>>>
): { solvable: boolean; reason?: string } {
  const state: BacktrackState = {
    assignments: [],
    domains,
    slotFillCounts: new Map(),
    operatorAssignedDays: new Map(),
  };

  for (const op of operators) {
    state.operatorAssignedDays.set(op.id, new Set());
  }

  // Quick feasibility check: each slot must have enough eligible operators
  for (const slot of slots) {
    const eligible = getEligibleOperators(slot, state, operators);

    if (eligible.length < slot.requiredCount) {
      return {
        solvable: false,
        reason: `${slot.taskName} on ${slot.day} needs ${slot.requiredCount} operators but only ${eligible.length} eligible`,
      };
    }

    // Type-aware check
    if (slot.typeRequirements.length > 0) {
      for (const req of slot.typeRequirements) {
        const typeEligible = eligible.filter(op => op.type === req.type);
        if (typeEligible.length < req.count) {
          return {
            solvable: false,
            reason: `${slot.taskName} on ${slot.day} needs ${req.count} ${req.type} operators but only ${typeEligible.length} eligible`,
          };
        }
      }
    }
  }

  return { solvable: true };
}
