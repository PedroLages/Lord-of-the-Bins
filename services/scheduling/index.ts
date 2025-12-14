/**
 * Scheduling Module Index
 *
 * Re-exports all scheduling-related functionality.
 */

// Types
export * from './constraintTypes';

// Constraint propagation
export { propagateConstraints, getCapableOperatorsForSlot, canAssignOperatorToSlot } from './constraintPropagator';

// Slot prioritization (MRV)
export {
  prioritizeSlots,
  getEligibleOperatorsForSlot,
  updateSlotPriorities,
  isSlotCritical,
  findInfeasibleSlots,
  groupSlotsByDay,
  groupSlotsByTask,
} from './slotPrioritizer';

// Enhanced scheduler
export { generateEnhancedSchedule } from './enhancedScheduler';

// Repair phase
export { repairViolations, findViolations } from './repairPhase';

// Existing modules (re-export for convenience)
export * from './objectiveCalculators';
export * from './tabuSearchOptimizer';
export * from './paretoFrontFinder';
