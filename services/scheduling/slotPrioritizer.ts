/**
 * Slot Prioritizer
 *
 * Implements the MRV (Most Restricted Variable) heuristic to order slots
 * for assignment. By processing the most constrained slots first, we avoid
 * painting ourselves into corners.
 *
 * The insight: If slot A can only be filled by 2 operators and slot B can
 * be filled by 10 operators, we should fill A first. If we fill B first,
 * we might accidentally use up the operators that A needs.
 */

import type { WeekDay } from '../../types';
import type { ConstraintSlot, PrioritizedSlot, PropagationParams } from './constraintTypes';

// Re-export PrioritizedSlot for use by other modules
export type { PrioritizedSlot } from './constraintTypes';

/**
 * Prioritize slots using the MRV heuristic.
 *
 * Orders slots by:
 * 1. Task tier (Tier 1 critical > Tier 2 conditional > Tier 3 fallback)
 * 2. Constrainedness (fewer eligible operators = higher priority)
 * 3. Required count (larger requirements first - fill big tasks early)
 *
 * @param remainingSlots - Slots that still need assignment
 * @param operatorDomains - Map of operator -> day -> possible taskIds
 * @param operators - Available operators
 * @returns Slots ordered by priority (process first element first)
 */
export function prioritizeSlots(
  remainingSlots: ConstraintSlot[],
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators']
): PrioritizedSlot[] {
  return remainingSlots
    .map(slot => {
      // Count eligible operators for this slot
      const eligibleOperators = countEligibleOperators(slot, operatorDomains, operators);

      const constrainedness = eligibleOperators / Math.max(slot.requiredCount, 1);

      return {
        ...slot,
        remainingCapacity: slot.requiredCount,
        domainSize: eligibleOperators,
        constrainedness,
      };
    })
    .sort((a, b) => {
      // 1. Lower tier first (Tier 1 > Tier 2 > Tier 3)
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      // 2. More constrained first (lower ratio = fewer options = higher priority)
      if (Math.abs(a.constrainedness - b.constrainedness) > 0.01) {
        return a.constrainedness - b.constrainedness;
      }

      // 3. Larger requirements first (fill big tasks early)
      if (a.requiredCount !== b.requiredCount) {
        return b.requiredCount - a.requiredCount;
      }

      // 4. Day order for consistency (Mon before Tue, etc.)
      const dayOrder: Record<WeekDay, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 };
      if (a.day !== b.day) {
        return dayOrder[a.day] - dayOrder[b.day];
      }

      // 5. Task name for determinism
      return a.taskName.localeCompare(b.taskName);
    });
}

/**
 * Count operators who can fill a specific slot.
 */
function countEligibleOperators(
  slot: ConstraintSlot,
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators']
): number {
  let count = 0;

  for (const operator of operators) {
    const dayDomain = operatorDomains.get(operator.id)?.get(slot.day);
    if (dayDomain?.has(slot.taskId)) {
      count++;
    }
  }

  return count;
}

/**
 * Get operators eligible for a slot, respecting type requirements.
 *
 * @param slot - The slot to fill
 * @param operatorDomains - Current operator domains
 * @param operators - All operators
 * @param assignedToday - Operators already assigned today
 * @returns List of eligible operators
 */
export function getEligibleOperatorsForSlot(
  slot: PrioritizedSlot,
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators'],
  assignedToday: Set<string>
): PropagationParams['operators'] {
  const eligible: PropagationParams['operators'] = [];

  for (const operator of operators) {
    // Skip if already assigned today
    if (assignedToday.has(operator.id)) continue;

    // Check if operator can do this task on this day
    const dayDomain = operatorDomains.get(operator.id)?.get(slot.day);
    if (!dayDomain?.has(slot.taskId)) continue;

    // Check type requirements if any
    if (slot.typeRequirements.length > 0) {
      const hasMatchingType = slot.typeRequirements.some(
        req => req.type === operator.type
      );
      if (!hasMatchingType) continue;
    }

    eligible.push(operator);
  }

  return eligible;
}

/**
 * Recalculate slot priorities after an assignment.
 * Updates domain sizes and constrainedness values.
 */
export function updateSlotPriorities(
  slots: PrioritizedSlot[],
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  operators: PropagationParams['operators'],
  recentlyAssignedOperatorId: string,
  assignedDay: WeekDay
): PrioritizedSlot[] {
  return slots.map(slot => {
    // If this slot is on the same day as the recent assignment,
    // we need to recalculate (the assigned operator is no longer available)
    if (slot.day === assignedDay) {
      const eligibleOperators = countEligibleOperators(slot, operatorDomains, operators) - 1;
      const constrainedness = Math.max(eligibleOperators, 0) / Math.max(slot.requiredCount, 1);

      return {
        ...slot,
        domainSize: Math.max(eligibleOperators, 0),
        constrainedness,
      };
    }

    return slot;
  });
}

/**
 * Check if a slot is completely constrained (critical - must fill immediately).
 */
export function isSlotCritical(slot: PrioritizedSlot): boolean {
  // Slot is critical if domain size equals required count
  // (no room for error - all eligible operators must be assigned)
  return slot.domainSize === slot.requiredCount && slot.requiredCount > 0;
}

/**
 * Find slots that have become infeasible (not enough operators left).
 */
export function findInfeasibleSlots(slots: PrioritizedSlot[]): PrioritizedSlot[] {
  return slots.filter(slot => slot.domainSize < slot.remainingCapacity);
}

/**
 * Group slots by day for efficient processing.
 */
export function groupSlotsByDay(
  slots: PrioritizedSlot[]
): Map<WeekDay, PrioritizedSlot[]> {
  const byDay = new Map<WeekDay, PrioritizedSlot[]>();

  for (const slot of slots) {
    const daySlots = byDay.get(slot.day) || [];
    daySlots.push(slot);
    byDay.set(slot.day, daySlots);
  }

  return byDay;
}

/**
 * Group slots by task for cross-day analysis.
 */
export function groupSlotsByTask(
  slots: PrioritizedSlot[]
): Map<string, PrioritizedSlot[]> {
  const byTask = new Map<string, PrioritizedSlot[]>();

  for (const slot of slots) {
    const taskSlots = byTask.get(slot.taskId) || [];
    taskSlots.push(slot);
    byTask.set(slot.taskId, taskSlots);
  }

  return byTask;
}
