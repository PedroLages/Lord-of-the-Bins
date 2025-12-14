# Scheduling Algorithm V2 - Implementation Plan

**Created:** December 10, 2025
**Status:** ✅ Implemented
**Goal:** Enhance scheduling with constraint propagation for better "exactly N" handling

## Implementation Status

| Phase | Status | Files |
|-------|--------|-------|
| Phase 1: Constraint Propagation | ✅ Complete | `constraintTypes.ts`, `constraintPropagator.ts` |
| Phase 2: MRV Slot Ordering | ✅ Complete | `slotPrioritizer.ts` |
| Phase 3: Enhanced Greedy | ✅ Complete | `enhancedScheduler.ts` |
| Phase 4: Repair Phase | ✅ Complete | `repairPhase.ts` |
| Phase 5: Integration | ✅ Complete | `schedulingService.ts` updated |

### Usage
Set `rules.algorithm = 'enhanced'` in scheduling rules to use the new algorithm.

---

## Executive Summary

Based on research into CP-SAT and constraint programming, the key improvement for Lord of the Bins is **not** to replace the greedy algorithm with a full CSP solver (which would require backend infrastructure), but to add **constraint propagation** before the greedy loop runs.

The insight: CP-SAT's power comes from propagating constraints before search. We can implement a lightweight version of this in TypeScript that:
1. Identifies **forced assignments** before greedy runs
2. Detects **infeasibility early** with clear messages
3. Orders slots by **most constrained first** (MRV heuristic)
4. Adds **lightweight repair** when constraints aren't perfectly satisfied

---

## Current Architecture Analysis

### What Works Well
- Deterministic hashing for reproducibility
- Pre-validation of Plan Builder requirements
- Task tier system (critical → conditional → fallback)
- TC group scheduling
- Scoring with multiple factors
- Conflict reporting

### What Needs Improvement
- No constraint propagation before assignment
- Greedy can "trap" itself by assigning needed operators elsewhere
- "Exactly N" requirements validated post-hoc, not during assignment
- No backtracking when early decisions are suboptimal

---

## Implementation Phases

### Phase 1: Constraint Propagation Layer (Est: 2-3 hours)

**Goal:** Identify forced assignments BEFORE the greedy loop runs

#### 1.1 Create New Types

```typescript
// services/scheduling/constraintTypes.ts

export interface ConstraintSlot {
  day: WeekDay;
  taskId: string;
  taskName: string;
  requiredCount: number;
  operatorType: OperatorTypeOption;
}

export interface ForcedAssignment {
  operatorId: string;
  operatorName: string;
  taskId: string;
  taskName: string;
  day: WeekDay;
  reason: string;  // e.g., "Only 3 operators can do Troubleshooter and 3 are required"
}

export interface PropagationResult {
  feasible: boolean;
  forcedAssignments: ForcedAssignment[];
  infeasibilityReasons: string[];
  remainingSlots: ConstraintSlot[];  // Slots that still need assignment
  operatorDomains: Map<string, Set<string>>;  // operatorId -> possible taskIds per day
}
```

#### 1.2 Implement Constraint Propagator

```typescript
// services/scheduling/constraintPropagator.ts

export function propagateConstraints(
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  taskRequirements: TaskRequirement[],
  excludedTasks: string[],
  currentAssignments: Record<string, Record<string, ScheduleAssignment>>
): PropagationResult {

  // Step 1: Build operator domains (which tasks each operator CAN do)
  const operatorDomains = buildOperatorDomains(operators, tasks, days, excludedTasks);

  // Step 2: Build slot constraints (what each task needs)
  const slotConstraints = buildSlotConstraints(tasks, days, taskRequirements, excludedTasks);

  // Step 3: Apply arc consistency (AC-3 algorithm simplified)
  const { feasible, reasons } = enforceArcConsistency(operatorDomains, slotConstraints);

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
    operatorDomains,
    slotConstraints,
    operators,
    tasks
  );

  // Step 5: Update domains after forced assignments
  applyForcedAssignments(operatorDomains, forcedAssignments);

  // Step 6: Calculate remaining slots
  const remainingSlots = calculateRemainingSlots(slotConstraints, forcedAssignments);

  return {
    feasible: true,
    forcedAssignments,
    infeasibilityReasons: [],
    remainingSlots,
    operatorDomains,
  };
}
```

#### 1.3 Forced Assignment Detection Logic

```typescript
function identifyForcedAssignments(
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  slotConstraints: SlotConstraint[],
  operators: Operator[],
  tasks: TaskType[]
): ForcedAssignment[] {
  const forced: ForcedAssignment[] = [];

  for (const slot of slotConstraints) {
    // Find operators who CAN do this task on this day
    const capableOperators = operators.filter(op => {
      const dayDomain = operatorDomains.get(op.id)?.get(slot.day);
      return dayDomain?.has(slot.taskId);
    });

    // If exactly the required number can do it, they're ALL forced
    if (capableOperators.length === slot.requiredCount && slot.requiredCount > 0) {
      capableOperators.forEach(op => {
        forced.push({
          operatorId: op.id,
          operatorName: op.name,
          taskId: slot.taskId,
          taskName: slot.taskName,
          day: slot.day,
          reason: `Only ${capableOperators.length} operator(s) can do ${slot.taskName} and exactly ${slot.requiredCount} required`,
        });
      });
    }
  }

  return forced;
}
```

---

### Phase 2: MRV Slot Ordering (Est: 1 hour)

**Goal:** Process most constrained slots first to avoid dead ends

#### 2.1 Slot Prioritization

```typescript
// services/scheduling/slotPrioritizer.ts

export interface PrioritizedSlot {
  day: WeekDay;
  taskId: string;
  taskName: string;
  requiredCount: number;
  remainingCapacity: number;  // How many operators can still be assigned
  domainSize: number;         // How many eligible operators remain
  constrainedness: number;    // domainSize / requiredCount (lower = more constrained)
  tier: 1 | 2 | 3;           // Task tier
}

export function prioritizeSlots(
  remainingSlots: ConstraintSlot[],
  operatorDomains: Map<string, Map<WeekDay, Set<string>>>,
  operators: Operator[],
  tasks: TaskType[]
): PrioritizedSlot[] {

  return remainingSlots
    .map(slot => {
      const task = tasks.find(t => t.id === slot.taskId);
      const eligibleOperators = countEligibleOperators(slot, operatorDomains, operators);

      return {
        ...slot,
        taskName: task?.name || '',
        remainingCapacity: slot.requiredCount,
        domainSize: eligibleOperators,
        constrainedness: eligibleOperators / Math.max(slot.requiredCount, 1),
        tier: getTaskTier(task?.name || ''),
      };
    })
    .sort((a, b) => {
      // 1. Lower tier first (Tier 1 > Tier 2 > Tier 3)
      if (a.tier !== b.tier) return a.tier - b.tier;

      // 2. More constrained first (lower ratio = more constrained)
      if (a.constrainedness !== b.constrainedness) {
        return a.constrainedness - b.constrainedness;
      }

      // 3. Larger requirements first (fill big tasks first)
      return b.requiredCount - a.requiredCount;
    });
}
```

---

### Phase 3: Enhanced Greedy with Propagation (Est: 2 hours)

**Goal:** Integrate propagation into the main scheduling loop

#### 3.1 New Main Function

```typescript
// services/scheduling/enhancedScheduler.ts

export function generateEnhancedSchedule(data: ScheduleRequestData): ScheduleResult {
  const { operators, tasks: allTasks, days, currentAssignments = {}, rules = DEFAULT_RULES, taskRequirements = [], excludedTasks = [] } = data;

  // Filter excluded tasks
  const tasks = filterExcludedTasks(allTasks, excludedTasks);

  const assignments: ScheduleResult['assignments'] = [];
  const warnings: ScheduleWarning[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: CONSTRAINT PROPAGATION
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 1: Constraint Propagation');

  const propagation = propagateConstraints(
    operators,
    tasks,
    days,
    taskRequirements,
    excludedTasks,
    currentAssignments
  );

  if (!propagation.feasible) {
    // Return early with infeasibility warning
    propagation.infeasibilityReasons.forEach(reason => {
      warnings.push({
        type: 'understaffed',
        message: `Infeasible: ${reason}`,
      });
    });
    console.log('[Enhanced Scheduler] ❌ Infeasible configuration detected');
    return { assignments, warnings };
  }

  // Apply forced assignments
  propagation.forcedAssignments.forEach(forced => {
    console.log(`[Enhanced Scheduler] Forced: ${forced.operatorName} → ${forced.taskName} (${forced.day})`);
    assignments.push({
      day: forced.day,
      operatorId: forced.operatorId,
      taskId: forced.taskId,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: PRIORITIZED GREEDY ASSIGNMENT
  // ═══════════════════════════════════════════════════════════════════
  console.log('[Enhanced Scheduler] Phase 2: Prioritized Greedy');

  const prioritizedSlots = prioritizeSlots(
    propagation.remainingSlots,
    propagation.operatorDomains,
    operators,
    tasks
  );

  // Track state
  const assignedOperators = buildAssignedOperatorsMap(assignments);
  const slotFillCount = buildSlotFillCountMap(assignments);

  for (const slot of prioritizedSlots) {
    const needed = slot.requiredCount - (slotFillCount.get(`${slot.day}-${slot.taskId}`) || 0);
    if (needed <= 0) continue;

    // Get eligible operators for this slot
    const candidates = getEligibleCandidates(
      slot,
      operators,
      propagation.operatorDomains,
      assignedOperators,
      rules
    );

    // Score and sort candidates
    const scoredCandidates = scoreCandidates(candidates, slot, rules, ...);

    // Assign top N candidates
    for (let i = 0; i < Math.min(needed, scoredCandidates.length); i++) {
      const candidate = scoredCandidates[i];
      assignments.push({
        day: slot.day,
        operatorId: candidate.operatorId,
        taskId: slot.taskId,
      });
      assignedOperators.get(slot.day)?.add(candidate.operatorId);
      incrementSlotFillCount(slotFillCount, slot.day, slot.taskId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: REPAIR (if needed)
  // ═══════════════════════════════════════════════════════════════════
  const violations = countRemainingViolations(assignments, taskRequirements, days, tasks);

  if (violations > 0) {
    console.log(`[Enhanced Scheduler] Phase 3: Repair (${violations} violations)`);
    repairViolations(assignments, operators, tasks, days, taskRequirements, rules);
  }

  // Validate and return
  warnings.push(...validateFinalSchedule(assignments, operators, tasks, rules));

  return { assignments, warnings };
}
```

---

### Phase 4: Repair Phase (Est: 1.5 hours)

**Goal:** Fix constraint violations via targeted swaps

#### 4.1 Repair Algorithm

```typescript
// services/scheduling/repairPhase.ts

export function repairViolations(
  assignments: ScheduleResult['assignments'],
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  taskRequirements: TaskRequirement[],
  rules: SchedulingRules,
  maxIterations: number = 50
): boolean {

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const violations = findViolations(assignments, taskRequirements, days, tasks);

    if (violations.length === 0) {
      console.log(`[Repair] ✅ All violations resolved in ${iteration} iterations`);
      return true;
    }

    // Pick first violation
    const violation = violations[0];

    if (violation.type === 'under') {
      // Need more operators for this task
      const swap = findSwapToIncrease(
        assignments,
        violation,
        operators,
        tasks,
        taskRequirements
      );

      if (swap) {
        applySwap(assignments, swap);
        console.log(`[Repair] Swap: ${swap.description}`);
      } else {
        // Can't fix this violation
        console.log(`[Repair] ⚠️ Cannot fix: ${violation.description}`);
        break;
      }
    } else {
      // Over-assigned - need to move someone away
      const swap = findSwapToDecrease(
        assignments,
        violation,
        operators,
        tasks,
        taskRequirements
      );

      if (swap) {
        applySwap(assignments, swap);
      } else {
        break;
      }
    }
  }

  return false;
}

interface Swap {
  operatorId: string;
  fromTaskId: string;
  toTaskId: string;
  day: WeekDay;
  description: string;
}

function findSwapToIncrease(
  assignments: ScheduleResult['assignments'],
  violation: Violation,
  operators: Operator[],
  tasks: TaskType[],
  taskRequirements: TaskRequirement[]
): Swap | null {

  const targetTask = tasks.find(t => t.id === violation.taskId);
  if (!targetTask) return null;

  // Find operators on OTHER tasks who can do THIS task
  for (const assignment of assignments) {
    if (assignment.day !== violation.day) continue;
    if (assignment.taskId === violation.taskId) continue;

    const operator = operators.find(o => o.id === assignment.operatorId);
    if (!operator) continue;

    // Can this operator do the target task?
    if (!operator.skills.includes(targetTask.requiredSkill as any)) continue;

    // Would removing them from their current task create a NEW violation?
    const currentTask = tasks.find(t => t.id === assignment.taskId);
    if (!currentTask) continue;

    const currentTaskReq = taskRequirements.find(r => r.taskId === assignment.taskId);
    if (currentTaskReq) {
      const requirements = getRequirementsForDay(currentTaskReq, violation.day);
      const required = getTotalFromRequirements(requirements);
      const currentCount = countAssignments(assignments, assignment.taskId, violation.day);

      // Only swap if current task has excess
      if (currentCount <= required) continue;
    }

    return {
      operatorId: operator.id,
      fromTaskId: assignment.taskId,
      toTaskId: violation.taskId,
      day: violation.day,
      description: `Move ${operator.name} from ${currentTask.name} to ${targetTask.name} on ${violation.day}`,
    };
  }

  return null;
}
```

---

### Phase 5: Integration (Est: 1 hour)

**Goal:** Wire new scheduler into App.tsx

#### 5.1 Add Algorithm Selection

```typescript
// In SchedulingRules interface
export interface SchedulingRules {
  // ... existing fields ...
  algorithm?: 'greedy' | 'enhanced' | 'greedy-tabu' | 'multi-objective';
}
```

#### 5.2 Update generateOptimizedSchedule

```typescript
export function generateOptimizedSchedule(data: ScheduleRequestData): ScheduleResult | ScheduleWithObjectives[] {
  const rules = data.rules || DEFAULT_RULES;
  const algorithm = rules.algorithm || 'enhanced'; // NEW DEFAULT

  switch (algorithm) {
    case 'enhanced':
      return generateEnhancedSchedule(data);  // NEW
    case 'greedy':
      return generateSmartSchedule(data);     // OLD (kept for comparison)
    case 'greedy-tabu':
      return generateSmartScheduleWithTabu(data);
    case 'multi-objective':
      return generateMultiObjectiveSchedules(data);
    default:
      return generateEnhancedSchedule(data);
  }
}
```

---

## File Structure

```
services/
├── schedulingService.ts           # Keep existing (backward compat)
└── scheduling/
    ├── index.ts                   # Re-exports
    ├── constraintTypes.ts         # New types
    ├── constraintPropagator.ts    # Phase 1: Propagation
    ├── slotPrioritizer.ts         # Phase 2: MRV ordering
    ├── enhancedScheduler.ts       # Phase 3: Main algorithm
    ├── repairPhase.ts             # Phase 4: Repair
    └── utils.ts                   # Shared helpers
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/scheduling/constraintPropagator.test.ts

describe('Constraint Propagator', () => {
  it('should identify forced assignments when capable operators = required', () => {
    const operators = [
      { id: '1', name: 'Alice', skills: ['Troubleshooter'], availability: { Mon: true } },
      { id: '2', name: 'Bob', skills: ['Troubleshooter'], availability: { Mon: true } },
      { id: '3', name: 'Carol', skills: ['Filler'], availability: { Mon: true } },
    ];

    const taskReqs = [{
      taskId: 't1',
      defaultRequirements: [{ type: 'Any', count: 2 }],
    }];

    const result = propagateConstraints(operators, tasks, ['Mon'], taskReqs, [], {});

    expect(result.feasible).toBe(true);
    expect(result.forcedAssignments).toHaveLength(2);
    expect(result.forcedAssignments.map(f => f.operatorId)).toContain('1');
    expect(result.forcedAssignments.map(f => f.operatorId)).toContain('2');
  });

  it('should detect infeasibility when not enough operators', () => {
    const operators = [
      { id: '1', name: 'Alice', skills: ['Troubleshooter'], availability: { Mon: true } },
    ];

    const taskReqs = [{
      taskId: 't1',
      defaultRequirements: [{ type: 'Any', count: 2 }],
    }];

    const result = propagateConstraints(operators, tasks, ['Mon'], taskReqs, [], {});

    expect(result.feasible).toBe(false);
    expect(result.infeasibilityReasons.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```typescript
// tests/e2e/enhancedScheduling.spec.ts

test('should satisfy Plan Builder exactly-N requirements', async ({ page }) => {
  // Set up Plan Builder with "exactly 3 for Troubleshooter"
  await page.click('button:has-text("Plan Builder")');
  // ... configure rule ...
  await page.click('button:has-text("Apply")');

  // Run Smart Fill
  await page.click('button:has-text("Smart Fill")');
  await page.waitForTimeout(1000);

  // Count Troubleshooter assignments
  // Should be exactly 3
});
```

---

## Migration Path

1. **Phase 1-4**: Implement new scheduler in `services/scheduling/` (no breaking changes)
2. **Phase 5**: Add as new algorithm option, default to 'enhanced'
3. **Testing**: Run both old and new side-by-side, compare results
4. **Deprecation**: After validation, mark old `generateSmartSchedule` as deprecated

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| "Exactly N" satisfaction | ~80% | 100% |
| Early infeasibility detection | No | Yes |
| Forced assignment explanation | No | Yes |
| Algorithm runtime | <100ms | <200ms |
| Code testability | Limited | Full unit test coverage |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| New algorithm slower | Keep old algorithm as fallback option |
| Edge cases not handled | Comprehensive unit tests, gradual rollout |
| Repair phase loops | Max iteration limit, track visited states |
| Breaking existing behavior | New algorithm as opt-in initially |

---

## Timeline

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Propagation | 2-3 hours | None |
| Phase 2: MRV Ordering | 1 hour | Phase 1 |
| Phase 3: Enhanced Greedy | 2 hours | Phase 1, 2 |
| Phase 4: Repair | 1.5 hours | Phase 3 |
| Phase 5: Integration | 1 hour | Phase 3, 4 |
| Testing | 2 hours | All phases |
| **Total** | **~10 hours** | |

---

## Summary

This plan implements the key insight from CP-SAT research: **constraint propagation before search**. By identifying forced assignments and detecting infeasibility early, we avoid the greedy algorithm "trapping" itself with suboptimal early decisions.

The approach is:
- **Browser-compatible** (pure TypeScript, no external solver)
- **Backward-compatible** (old algorithm kept as option)
- **Incremental** (can be implemented in phases)
- **Testable** (modular design with clear interfaces)

This is the right level of complexity for Lord of the Bins — more sophisticated than pure greedy, but not the full CSP machinery that would require backend infrastructure.
