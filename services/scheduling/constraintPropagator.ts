/**
 * Constraint Propagator
 *
 * This module implements constraint propagation to identify forced assignments
 * and detect infeasibility BEFORE the greedy search begins.
 *
 * Key insight from CP-SAT research: The power of constraint programming comes
 * from propagating constraints before search. By identifying forced assignments
 * early, we avoid the greedy algorithm "trapping" itself with suboptimal decisions.
 */

import type { WeekDay, OperatorTypeOption, TaskRequirement, Operator, TaskType, ScheduleAssignment } from '../../types';
import { getRequirementsForDay, getTotalFromRequirements } from '../../types';
import type {
  PropagationResult,
  PropagationParams,
  ConstraintSlot,
  ForcedAssignment,
  SlotFillState,
  TypeCapabilityBreakdown,
  TypeFeasibilityResult,
  ConcreteOperatorType,
} from './constraintTypes';
import { getTaskTierForConstraints } from './constraintTypes';

// Skills that are exclusive to Team Coordinators
const TC_SKILLS = ['Process', 'People', 'Off Process'];

/**
 * Main entry point for constraint propagation.
 *
 * This function:
 * 1. Builds operator domains (which tasks each operator CAN do per day)
 * 2. Builds slot constraints (what each task needs per day)
 * 3. Applies arc consistency to prune invalid values
 * 4. Identifies forced assignments
 * 5. Returns the propagation result
 */
export function propagateConstraints(params: PropagationParams): PropagationResult {
  const { operators, tasks, days, taskRequirements, excludedTasks, currentAssignments } = params;

  // Filter to active, non-archived operators
  const activeOperators = operators.filter(
    op => op.status === 'Active' && !(op as any).archived
  );

  // Filter out excluded tasks
  const activeTasks = tasks.filter(t => !excludedTasks.includes(t.name));

  // Step 1: Build initial operator domains
  // For each operator and day, what tasks can they do?
  const operatorDomains = buildOperatorDomains(activeOperators, activeTasks, days, currentAssignments);

  // Step 2: Build slot constraints
  // For each task and day, how many operators are needed?
  const slotConstraints = buildSlotConstraints(activeTasks, days, taskRequirements);

  // Step 3: Check for immediately infeasible slots
  const { feasible, reasons } = checkFeasibility(slotConstraints, operatorDomains, activeOperators, days);

  if (!feasible) {
    return {
      feasible: false,
      forcedAssignments: [],
      infeasibilityReasons: reasons,
      remainingSlots: [],
      operatorDomains,
    };
  }

  // Step 4: Identify forced assignments
  const forcedAssignments = identifyForcedAssignments(
    slotConstraints,
    operatorDomains,
    activeOperators,
    activeTasks
  );

  // Step 5: Apply forced assignments and update domains
  const updatedDomains = applyForcedAssignments(operatorDomains, forcedAssignments);

  // Step 6: Calculate remaining slots
  const remainingSlots = calculateRemainingSlots(slotConstraints, forcedAssignments, activeTasks);

  return {
    feasible: true,
    forcedAssignments,
    infeasibilityReasons: [],
    remainingSlots,
    operatorDomains: updatedDomains,
  };
}

/**
 * Build operator domains: for each operator and day, what tasks can they do?
 */
function buildOperatorDomains(
  operators: PropagationParams['operators'],
  tasks: PropagationParams['tasks'],
  days: WeekDay[],
  currentAssignments: PropagationParams['currentAssignments']
): Map<string, Map<WeekDay, Set<string>>> {
  const domains = new Map<string, Map<WeekDay, Set<string>>>();

  for (const operator of operators) {
    const dayMap = new Map<WeekDay, Set<string>>();

    for (const day of days) {
      const taskIds = new Set<string>();

      // Check if operator is available this day
      if (!operator.availability[day]) {
        dayMap.set(day, taskIds);
        continue;
      }

      // Check if operator is already assigned (pinned/locked)
      const existingAssignment = currentAssignments[operator.id]?.[day];
      if (existingAssignment?.pinned || existingAssignment?.locked) {
        // Operator is fixed - domain is just their current task
        if (existingAssignment.taskId) {
          taskIds.add(existingAssignment.taskId);
        }
        dayMap.set(day, taskIds);
        continue;
      }

      // For each task, check if operator has required skill
      for (const task of tasks) {
        // Coordinators can only do TC skills
        if (operator.type === 'Coordinator') {
          if (TC_SKILLS.includes(task.requiredSkill) && operator.skills.includes(task.requiredSkill)) {
            taskIds.add(task.id);
          }
        } else {
          // Regular/Flex operators cannot do TC skills
          if (!TC_SKILLS.includes(task.requiredSkill) && operator.skills.includes(task.requiredSkill)) {
            taskIds.add(task.id);
          }
        }
      }

      dayMap.set(day, taskIds);
    }

    domains.set(operator.id, dayMap);
  }

  return domains;
}

/**
 * Build slot constraints: for each task and day, how many operators are needed?
 */
function buildSlotConstraints(
  tasks: PropagationParams['tasks'],
  days: WeekDay[],
  taskRequirements: PropagationParams['taskRequirements']
): ConstraintSlot[] {
  const slots: ConstraintSlot[] = [];

  for (const task of tasks) {
    for (const day of days) {
      // Find requirement for this task
      const taskReq = taskRequirements.find(tr => tr.taskId === task.id && tr.enabled !== false);

      let requiredCount = 0;
      let typeRequirements: Array<{ type: OperatorTypeOption; count: number }> = [];

      if (taskReq) {
        const requirements = getRequirementsForDay(taskReq as TaskRequirement, day);
        requiredCount = getTotalFromRequirements(requirements);
        typeRequirements = requirements.map(r => ({ type: r.type, count: r.count }));
      }

      // Only add slot if there's a requirement
      if (requiredCount > 0) {
        slots.push({
          day,
          taskId: task.id,
          taskName: task.name,
          requiredSkill: task.requiredSkill,
          requiredCount,
          typeRequirements,
          tier: getTaskTierForConstraints(task.name),
        });
      }
    }
  }

  return slots;
}

/**
 * Check if constraints are feasible (can potentially be satisfied).
 * NOW TYPE-AWARE: Validates that enough operators of each required type exist.
 */
function checkFeasibility(
  slots: ConstraintSlot[],
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators'],
  days: WeekDay[]
): { feasible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const slot of slots) {
    // Get type-aware capability breakdown
    const typeBreakdown = getTypeCapabilityBreakdown(slot, domains, operators);

    // Check total capacity first (quick fail)
    if (typeBreakdown.Any < slot.requiredCount) {
      const capableNames = getCapableOperatorNames(slot, domains, operators);
      reasons.push(
        `${slot.taskName} on ${slot.day} requires ${slot.requiredCount} operator(s) ` +
        `but only ${typeBreakdown.Any} can do it: ${capableNames.join(', ') || 'none'}`
      );
      continue;
    }

    // NOW CHECK TYPE-SPECIFIC REQUIREMENTS
    if (slot.typeRequirements.length > 0) {
      const typeResult = checkTypeRequirementsFeasibility(slot, typeBreakdown, operators, domains);
      if (!typeResult.feasible && typeResult.reason) {
        reasons.push(typeResult.reason);
      }
    }
  }

  // Check for operator overload on same day (operator can only do ONE task per day)
  for (const day of days) {
    const daySlots = slots.filter(s => s.day === day);
    const totalRequired = daySlots.reduce((sum, s) => sum + s.requiredCount, 0);
    const availableOperators = operators.filter(op => {
      const dayDomain = domains.get(op.id)?.get(day);
      return dayDomain && dayDomain.size > 0;
    });

    if (availableOperators.length < totalRequired) {
      reasons.push(
        `${day} requires ${totalRequired} total assignments but only ${availableOperators.length} operators available`
      );
    }
  }

  return {
    feasible: reasons.length === 0,
    reasons,
  };
}

/**
 * Get capability breakdown by operator type for a slot.
 */
function getTypeCapabilityBreakdown(
  slot: ConstraintSlot,
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators']
): TypeCapabilityBreakdown {
  const breakdown: TypeCapabilityBreakdown = {
    Regular: 0,
    Flex: 0,
    Coordinator: 0,
    Any: 0,
  };

  for (const operator of operators) {
    const dayDomain = domains.get(operator.id)?.get(slot.day);
    if (dayDomain?.has(slot.taskId)) {
      breakdown[operator.type as ConcreteOperatorType]++;
      breakdown.Any++;
    }
  }

  return breakdown;
}

/**
 * Get names of operators capable of filling a slot (for error messages).
 */
function getCapableOperatorNames(
  slot: ConstraintSlot,
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators']
): string[] {
  const names: string[] = [];
  for (const operator of operators) {
    const dayDomain = domains.get(operator.id)?.get(slot.day);
    if (dayDomain?.has(slot.taskId)) {
      names.push(`${operator.name} (${operator.type})`);
    }
  }
  return names;
}

/**
 * Check if type-specific requirements can be satisfied.
 * Validates specific type counts (Regular, Flex).
 */
function checkTypeRequirementsFeasibility(
  slot: ConstraintSlot,
  available: TypeCapabilityBreakdown,
  operators: PropagationParams['operators'],
  domains: Map<string, Map<WeekDay, Set<string>>>
): { feasible: boolean; reason?: string } {
  // Track required counts by specific type
  let requiredRegular = 0;
  let requiredFlex = 0;

  for (const req of slot.typeRequirements) {
    if (req.type === 'Regular') {
      requiredRegular += req.count;
    } else if (req.type === 'Flex') {
      requiredFlex += req.count;
    }
    // Coordinator requirements handled separately (TC tasks)
  }

  // Check specific type requirements
  if (requiredRegular > available.Regular) {
    return {
      feasible: false,
      reason: `${slot.taskName} on ${slot.day} requires ${requiredRegular} Regular operator(s) ` +
        `but only ${available.Regular} Regular can do it`,
    };
  }

  if (requiredFlex > available.Flex) {
    // Check if we can use Regular as fallback for Flex
    const flexShortage = requiredFlex - available.Flex;
    const regularSurplus = available.Regular - requiredRegular;

    if (regularSurplus < flexShortage) {
      return {
        feasible: false,
        reason: `${slot.taskName} on ${slot.day} requires ${requiredFlex} Flex operator(s) ` +
          `but only ${available.Flex} Flex can do it (and only ${regularSurplus} Regular surplus for fallback)`,
      };
    }
    // Flex can be satisfied with Regular fallback
  }

  return { feasible: true };
}

/**
 * Identify forced assignments: where exactly N operators can fill N slots.
 * NOW TYPE-AWARE: Also detects when specific operator types are forced.
 *
 * A forced assignment occurs when:
 * 1. Total capable = total required (classic case)
 * 2. Capable of type X = required of type X (type-specific case)
 * 3. After type-specific forced, remaining capable = remaining required
 */
function identifyForcedAssignments(
  slots: ConstraintSlot[],
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators'],
  tasks: PropagationParams['tasks']
): ForcedAssignment[] {
  const forced: ForcedAssignment[] = [];

  // Track which operators are already force-assigned per day
  const forcedPerDay = new Map<WeekDay, Set<string>>();

  // Sort slots by tier (process critical slots first) then by constrainedness
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;

    // Calculate constrainedness (eligible operators / required)
    const aCapable = countCapableOperators(a, domains, operators);
    const bCapable = countCapableOperators(b, domains, operators);
    const aRatio = aCapable / Math.max(a.requiredCount, 1);
    const bRatio = bCapable / Math.max(b.requiredCount, 1);

    return aRatio - bRatio; // More constrained first
  });

  for (const slot of sortedSlots) {
    // Get already-forced operators for this day
    const dayForced = forcedPerDay.get(slot.day) || new Set<string>();

    // Find operators who can do this task on this day (not already forced)
    const capableOperators = operators.filter(op => {
      if (dayForced.has(op.id)) return false;
      const dayDomain = domains.get(op.id)?.get(slot.day);
      return dayDomain?.has(slot.taskId);
    });

    // Group capable operators by type
    const capableByType: Record<ConcreteOperatorType, typeof operators> = {
      Regular: [],
      Flex: [],
      Coordinator: [],
    };
    for (const op of capableOperators) {
      capableByType[op.type as ConcreteOperatorType].push(op);
    }

    // Track operators forced in this iteration
    const newlyForced = new Set<string>();

    // PHASE 1: Check type-specific forced assignments
    if (slot.typeRequirements.length > 0) {
      for (const req of slot.typeRequirements) {
        const targetType = req.type as ConcreteOperatorType;
        const capableOfType = capableByType[targetType];

        // If exactly the required number of this type can do it, they're ALL forced
        if (capableOfType.length === req.count && req.count > 0) {
          for (const op of capableOfType) {
            if (newlyForced.has(op.id)) continue;

            forced.push({
              operatorId: op.id,
              operatorName: op.name,
              taskId: slot.taskId,
              taskName: slot.taskName,
              day: slot.day,
              reason: `Only ${capableOfType.length} ${targetType} operator(s) can do ${slot.taskName} and exactly ${req.count} ${targetType} required`,
            });
            newlyForced.add(op.id);
          }
        }
      }
    }

    // PHASE 2: Check if remaining capacity is exactly filled by remaining operators
    // Calculate how many more operators we need after type-specific forced
    const forcedForSlot = newlyForced.size;
    const remainingRequired = slot.requiredCount - forcedForSlot;

    // Get remaining capable operators (not forced yet)
    const remainingCapable = capableOperators.filter(op => !newlyForced.has(op.id));

    // If exactly the remaining number can do it, they're ALL forced
    if (remainingCapable.length === remainingRequired && remainingRequired > 0) {
      for (const op of remainingCapable) {
        forced.push({
          operatorId: op.id,
          operatorName: op.name,
          taskId: slot.taskId,
          taskName: slot.taskName,
          day: slot.day,
          reason: `Only ${remainingCapable.length} operator(s) remain for ${slot.taskName} and exactly ${remainingRequired} more required`,
        });
        newlyForced.add(op.id);
      }
    }

    // PHASE 3: Classic check - total capable = total required (no type requirements)
    if (slot.typeRequirements.length === 0 &&
        capableOperators.length === slot.requiredCount &&
        slot.requiredCount > 0) {
      for (const op of capableOperators) {
        if (newlyForced.has(op.id)) continue;

        forced.push({
          operatorId: op.id,
          operatorName: op.name,
          taskId: slot.taskId,
          taskName: slot.taskName,
          day: slot.day,
          reason: `Only ${capableOperators.length} operator(s) can do ${slot.taskName} and exactly ${slot.requiredCount} required`,
        });
        newlyForced.add(op.id);
      }
    }

    // Update forcedPerDay with newly forced operators
    if (newlyForced.size > 0) {
      if (!forcedPerDay.has(slot.day)) {
        forcedPerDay.set(slot.day, new Set());
      }
      Array.from(newlyForced).forEach(opId => {
        forcedPerDay.get(slot.day)!.add(opId);
      });
    }
  }

  return forced;
}

/**
 * Count operators capable of filling a slot.
 */
function countCapableOperators(
  slot: ConstraintSlot,
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators']
): number {
  let count = 0;
  for (const op of operators) {
    const dayDomain = domains.get(op.id)?.get(slot.day);
    if (dayDomain?.has(slot.taskId)) {
      count++;
    }
  }
  return count;
}

/**
 * Apply forced assignments by removing those operators from other tasks' domains.
 */
function applyForcedAssignments(
  domains: Map<string, Map<WeekDay, Set<string>>>,
  forcedAssignments: ForcedAssignment[]
): Map<string, Map<WeekDay, Set<string>>> {
  // Clone domains
  const updatedDomains = new Map<string, Map<WeekDay, Set<string>>>();
  Array.from(domains.entries()).forEach(([opId, dayMap]) => {
    const newDayMap = new Map<WeekDay, Set<string>>();
    Array.from(dayMap.entries()).forEach(([day, taskSet]) => {
      newDayMap.set(day, new Set(taskSet));
    });
    updatedDomains.set(opId, newDayMap);
  });

  // For each forced assignment, reduce that operator's domain for that day to just that task
  for (const assignment of forcedAssignments) {
    const dayMap = updatedDomains.get(assignment.operatorId);
    if (dayMap) {
      // Operator can only do their forced task on this day
      dayMap.set(assignment.day, new Set([assignment.taskId]));
    }
  }

  return updatedDomains;
}

/**
 * Calculate remaining slots after forced assignments.
 */
function calculateRemainingSlots(
  slots: ConstraintSlot[],
  forcedAssignments: ForcedAssignment[],
  tasks: PropagationParams['tasks']
): ConstraintSlot[] {
  const remaining: ConstraintSlot[] = [];

  // Count forced assignments per slot
  const forcedCounts = new Map<string, number>();
  for (const assignment of forcedAssignments) {
    const key = `${assignment.day}-${assignment.taskId}`;
    forcedCounts.set(key, (forcedCounts.get(key) || 0) + 1);
  }

  for (const slot of slots) {
    const key = `${slot.day}-${slot.taskId}`;
    const forcedCount = forcedCounts.get(key) || 0;
    const remaining_needed = slot.requiredCount - forcedCount;

    if (remaining_needed > 0) {
      remaining.push({
        ...slot,
        requiredCount: remaining_needed,
      });
    }
  }

  return remaining;
}

/**
 * Utility: Get operators who can fill a specific slot.
 */
export function getCapableOperatorsForSlot(
  slot: ConstraintSlot,
  domains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators'],
  excludeOperatorIds: Set<string> = new Set()
): PropagationParams['operators'] {
  return operators.filter(op => {
    if (excludeOperatorIds.has(op.id)) return false;
    const dayDomain = domains.get(op.id)?.get(slot.day);
    return dayDomain?.has(slot.taskId);
  });
}

/**
 * Utility: Check if an operator can be assigned to a slot.
 */
export function canAssignOperatorToSlot(
  operatorId: string,
  slot: ConstraintSlot,
  domains: Map<string, Map<WeekDay, Set<string>>>
): boolean {
  const dayDomain = domains.get(operatorId)?.get(slot.day);
  return dayDomain?.has(slot.taskId) ?? false;
}
