/**
 * Constraint Propagation Types
 *
 * These types support the enhanced scheduling algorithm that uses constraint
 * propagation to identify forced assignments and detect infeasibility BEFORE
 * the greedy search begins.
 */

import type { WeekDay, OperatorTypeOption } from '../../types';

/**
 * A slot represents a single (day, task) combination that needs to be filled.
 * It captures the requirements and constraints for that slot.
 */
export interface ConstraintSlot {
  day: WeekDay;
  taskId: string;
  taskName: string;
  requiredSkill: string;
  /** Total operators required for this slot */
  requiredCount: number;
  /** Breakdown by operator type if specified */
  typeRequirements: Array<{
    type: OperatorTypeOption;
    count: number;
  }>;
  /** Task tier (1 = critical, 2 = conditional, 3 = fallback) */
  tier: 1 | 2 | 3;
}

/**
 * A forced assignment is one where constraint propagation has determined
 * that a specific operator MUST be assigned to a specific task on a specific day.
 * This happens when there's exactly the number of capable operators as required.
 */
export interface ForcedAssignment {
  operatorId: string;
  operatorName: string;
  taskId: string;
  taskName: string;
  day: WeekDay;
  /** Human-readable explanation of why this assignment is forced */
  reason: string;
}

/**
 * Result of constraint propagation.
 * Either the constraints are feasible (can potentially be satisfied)
 * or they are infeasible (impossible to satisfy).
 */
export interface PropagationResult {
  /** Whether the constraints can potentially be satisfied */
  feasible: boolean;
  /** Assignments that must be made (no choice) */
  forcedAssignments: ForcedAssignment[];
  /** If infeasible, explanations of why */
  infeasibilityReasons: string[];
  /** Slots that still need assignment after forced assignments */
  remainingSlots: ConstraintSlot[];
  /**
   * For each operator and day, which tasks they can still be assigned to.
   * Map<operatorId, Map<day, Set<taskId>>>
   */
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>;
}

/**
 * A prioritized slot includes additional information for MRV (Most Restricted Variable) ordering.
 * The scheduler processes more constrained slots first to avoid dead ends.
 */
export interface PrioritizedSlot extends ConstraintSlot {
  /** How many operators still need to be assigned to fill this slot */
  remainingCapacity: number;
  /** How many eligible operators remain for this slot */
  domainSize: number;
  /** domainSize / requiredCount - lower = more constrained */
  constrainedness: number;
}

/**
 * A constraint violation found during or after scheduling.
 */
export interface ConstraintViolation {
  type: 'under' | 'over';
  taskId: string;
  taskName: string;
  day: WeekDay;
  required: number;
  actual: number;
  description: string;
}

/**
 * A swap operation for the repair phase.
 * Moves an operator from one task to another on the same day.
 */
export interface RepairSwap {
  operatorId: string;
  operatorName: string;
  fromTaskId: string;
  fromTaskName: string;
  toTaskId: string;
  toTaskName: string;
  day: WeekDay;
  description: string;
}

/**
 * Internal type for tracking slot fill state during propagation.
 */
export interface SlotFillState {
  taskId: string;
  day: WeekDay;
  required: number;
  assigned: number;
  assignedOperatorIds: Set<string>;
}

/**
 * Type-aware capability tracking.
 * Tracks how many operators of each type can do a specific task.
 */
export interface TypeCapabilityBreakdown {
  Regular: number;
  Flex: number;
  Coordinator: number;
  Any: number; // Total capable (sum of Regular + Flex + Coordinator)
}

/**
 * Type feasibility result for a single slot.
 */
export interface TypeFeasibilityResult {
  feasible: boolean;
  slot: ConstraintSlot;
  required: TypeCapabilityBreakdown;
  available: TypeCapabilityBreakdown;
  shortage: TypeCapabilityBreakdown;
  reason?: string;
}

/**
 * Operator type for constraint checking.
 */
export type ConcreteOperatorType = 'Regular' | 'Flex' | 'Coordinator';

/**
 * Parameters for the propagation algorithm.
 */
export interface PropagationParams {
  /** Available operators (active, non-archived) */
  operators: Array<{
    id: string;
    name: string;
    skills: string[];
    type: 'Regular' | 'Flex' | 'Coordinator';
    status: 'Active' | 'Sick' | 'Leave';
    availability: Record<WeekDay, boolean>;
  }>;
  /** Tasks to schedule (excluding any skipped tasks) */
  tasks: Array<{
    id: string;
    name: string;
    requiredSkill: string;
  }>;
  /** Days to schedule */
  days: WeekDay[];
  /** Task requirements from Plan Builder */
  taskRequirements: Array<{
    taskId: string;
    defaultRequirements: Array<{ type: OperatorTypeOption; count: number }>;
    dailyOverrides?: Partial<Record<WeekDay, Array<{ type: OperatorTypeOption; count: number }>>>;
    enabled?: boolean;
  }>;
  /** Task names to exclude from scheduling */
  excludedTasks: string[];
  /** Existing assignments (pinned or locked) */
  currentAssignments: Record<string, Record<string, { taskId: string | null; locked: boolean; pinned?: boolean }>>;
}

/**
 * Get tier for a task name.
 * Re-exported for use in constraint propagation.
 */
export function getTaskTierForConstraints(taskName: string): 1 | 2 | 3 {
  const TIER_2_TASKS = ['Exceptions', 'Filler'];
  const TIER_3_TASKS = ['Decanting'];

  if (TIER_3_TASKS.includes(taskName)) return 3;
  if (TIER_2_TASKS.includes(taskName)) return 2;
  return 1;
}
