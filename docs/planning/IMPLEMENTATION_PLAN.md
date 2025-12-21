# Scheduling Algorithm Enhancement - Implementation Plan
**Date:** December 9, 2025
**Status:** Ready to Implement (Phased Approach)

---

## Executive Summary

After comprehensive research and feasibility analysis, we're implementing a **phased approach** to enhance the scheduling algorithm:

- **Phase 1 (Immediate):** Tabu Search + Multi-Objective Optimization
- **Phase 2 (Future):** CP-SAT Solver (requires backend)

---

## Feasibility Analysis Results

### ✅ Immediately Implementable

#### 1. Tabu Search Refinement
- **Pure TypeScript** - No dependencies
- **Research-backed** - "Should be tried first" per academic literature
- **Client-side compatible** - Runs in browser
- **Expected impact:** 5-10% schedule quality improvement

#### 2. Multi-Objective Optimization
- **Pure TypeScript** - No dependencies
- **Better UX** - Users see trade-offs, not hidden weights
- **Client-side compatible** - Runs in browser
- **Expected impact:** Better user control + understanding

### ⚠️ Requires Architectural Changes

#### 3. CP-SAT Solver Integration
- **Problem:** No mature JavaScript/TypeScript bindings for OR-Tools
- **Finding:** [node_or_tools](https://www.npmjs.com/package/node_or_tools) only supports TSP/VRP, not general CP-SAT
- **OR-Tools official support:** C++, Python, Java, .NET only
- **Requires:** Backend service (Python/Java) or WebAssembly compilation
- **Expected impact:** 10-20% improvement + optimality guarantees

**Decision:** Defer to Phase 2, implement what's feasible now.

**Source:** [GitHub Issue #94 - JavaScript bindings](https://github.com/google/or-tools/issues/94)

---

## Phase 1 Implementation (This Sprint)

### Part A: Tabu Search Algorithm

**Goal:** Add post-optimization refinement to escape local optima

**Implementation:**
```typescript
// services/scheduling/tabuSearchOptimizer.ts

interface TabuSearchOptions {
  maxIterations: number;
  tabuListSize: number;
  objectiveWeights: ObjectiveWeights;
}

export function refineScheduleWithTabuSearch(
  initialSchedule: ScheduleResult,
  data: ScheduleRequestData,
  options: TabuSearchOptions
): ScheduleResult {
  // 1. Initialize
  let currentSolution = initialSchedule;
  let bestSolution = initialSchedule;
  const tabuList = new TabuList(options.tabuListSize);

  // 2. Iterate
  for (let iter = 0; iter < options.maxIterations; iter++) {
    // Generate neighborhood (swap assignments)
    const neighbors = generateNeighborhood(currentSolution, data);

    // Filter tabu moves (allow aspiration criterion)
    const candidates = neighbors.filter(n =>
      !tabuList.contains(n.move) ||
      n.objective > bestSolution.objective
    );

    // Pick best non-tabu neighbor
    const best = selectBest(candidates, options.objectiveWeights);
    if (!best) break;

    // Update
    currentSolution = best.solution;
    tabuList.add(best.move);

    if (best.objective > bestSolution.objective) {
      bestSolution = best.solution;
    }
  }

  return bestSolution;
}
```

**Key Components:**
1. **Neighborhood Generation** - Swap operator assignments
2. **Tabu List** - Circular buffer of recent moves (prevent cycles)
3. **Aspiration Criterion** - Override tabu if move improves best solution
4. **Objective Function** - Multi-objective scoring (see Part B)

**Files to Create:**
- `services/scheduling/tabuSearchOptimizer.ts` - Main algorithm
- `services/scheduling/neighborhoodGenerator.ts` - Move generation
- `services/scheduling/tabuList.ts` - Tabu memory structure

---

### Part B: Multi-Objective Optimization

**Goal:** Expose trade-offs to users via Pareto-optimal solutions

**Implementation:**
```typescript
// services/scheduling/multiObjectiveOptimizer.ts

export interface ObjectiveScores {
  fairness: number;         // Lower variance = better
  workloadBalance: number;  // Lower std dev = better
  skillMatch: number;       // Higher = better
  operatorPreference: number; // Higher = better
  scheduleVariety: number;  // Higher = better
  totalScore: number;       // Weighted combination
}

export interface ScheduleWithObjectives {
  schedule: ScheduleResult;
  objectives: ObjectiveScores;
}

// Calculate all objective scores for a schedule
export function calculateObjectives(
  schedule: ScheduleResult,
  data: ScheduleRequestData
): ObjectiveScores {
  return {
    fairness: calculateFairnessScore(schedule, data),
    workloadBalance: calculateWorkloadBalance(schedule, data),
    skillMatch: calculateSkillMatchScore(schedule, data),
    operatorPreference: calculatePreferenceScore(schedule, data),
    scheduleVariety: calculateVarietyScore(schedule, data),
    totalScore: 0, // Calculated with weights
  };
}

// Find Pareto-optimal set (non-dominated solutions)
export function findParetoFront(
  schedules: ScheduleWithObjectives[]
): ScheduleWithObjectives[] {
  return schedules.filter(scheduleA =>
    !schedules.some(scheduleB =>
      strictlyDominates(scheduleB.objectives, scheduleA.objectives)
    )
  );
}

// Schedule A dominates B if A is better in all objectives
function strictlyDominates(a: ObjectiveScores, b: ObjectiveScores): boolean {
  return (
    a.fairness <= b.fairness &&
    a.workloadBalance <= b.workloadBalance &&
    a.skillMatch >= b.skillMatch &&
    a.operatorPreference >= b.operatorPreference &&
    a.scheduleVariety >= b.scheduleVariety &&
    (a.fairness < b.fairness || // At least one strictly better
     a.workloadBalance < b.workloadBalance ||
     a.skillMatch > b.skillMatch ||
     a.operatorPreference > b.operatorPreference ||
     a.scheduleVariety > b.scheduleVariety)
  );
}
```

**Objective Functions:**

1. **Fairness** = `std_dev(operator_workloads)` - Lower is better
2. **Workload Balance** = `max(workload) - min(workload)` - Lower is better
3. **Skill Match** = `% assignments with perfect skill match` - Higher is better
4. **Operator Preference** = `% assignments at preferred stations` - Higher is better
5. **Schedule Variety** = `avg(unique tasks per operator)` - Higher is better

**Files to Create:**
- `services/scheduling/multiObjectiveOptimizer.ts` - Main logic
- `services/scheduling/objectiveCalculators.ts` - Individual metrics
- `services/scheduling/paretoFront.ts` - Dominance detection

---

### Part C: Enhanced Scheduling Service

**Goal:** Integrate new algorithms into existing service

**Updates to `schedulingService.ts`:**

```typescript
// New algorithm selection enum
export type SchedulingAlgorithm =
  | 'greedy'           // Current algorithm
  | 'greedy-tabu'      // Greedy + Tabu Search
  | 'multi-objective'; // Generate Pareto front

// Extended scheduling rules
export interface SchedulingRules {
  // ... existing rules ...
  algorithm: SchedulingAlgorithm;
  tabuSearchIterations?: number; // Default: 100
  tabuListSize?: number;         // Default: 20
  generateParetoFront?: boolean; // For multi-objective
}

// Main entry point with algorithm selection
export function generateOptimizedSchedule(
  data: ScheduleRequestData
): ScheduleResult | ScheduleResult[] {
  const rules = data.rules || DEFAULT_RULES;

  switch (rules.algorithm) {
    case 'greedy':
      return generateSmartSchedule(data);

    case 'greedy-tabu':
      const initial = generateSmartSchedule(data);
      return refineScheduleWithTabuSearch(initial, data, {
        maxIterations: rules.tabuSearchIterations || 100,
        tabuListSize: rules.tabuListSize || 20,
        objectiveWeights: extractWeights(rules),
      });

    case 'multi-objective':
      return generateParetoSchedules(data);

    default:
      return generateSmartSchedule(data);
  }
}
```

---

### Part D: User Interface Enhancements

**Goal:** Let users choose algorithms and see trade-offs

**New Components:**

1. **Algorithm Selection** (Settings)
```typescript
<select value={rules.algorithm} onChange={handleAlgorithmChange}>
  <option value="greedy">Standard (Fast)</option>
  <option value="greedy-tabu">Enhanced (Tabu Search)</option>
  <option value="multi-objective">Trade-off Analysis</option>
</select>
```

2. **Pareto Front Viewer** (PlanningModal)
```typescript
// When multi-objective selected, show multiple options
<div className="pareto-options">
  {paretoSchedules.map((s, i) => (
    <div key={i} className="schedule-option">
      <h4>Option {i + 1}</h4>
      <div className="objectives">
        <Metric name="Fairness" value={s.objectives.fairness} />
        <Metric name="Skill Match" value={s.objectives.skillMatch} />
        {/* ... other objectives ... */}
      </div>
      <button onClick={() => selectSchedule(s)}>Use This Schedule</button>
    </div>
  ))}
</div>
```

3. **Objective Score Dashboard**
```typescript
// Show objective breakdown for current schedule
<ObjectiveScoreCard
  objectives={currentSchedule.objectives}
  showComparison={true}
/>
```

---

## Implementation Timeline

### Week 1: Core Algorithms
- **Day 1-2:** Tabu Search implementation
  - Neighborhood generator
  - Tabu list structure
  - Main optimization loop

- **Day 3-4:** Multi-Objective implementation
  - Objective calculators
  - Pareto dominance logic
  - Front finder

- **Day 5:** Integration & testing
  - Update schedulingService
  - Unit tests
  - Performance profiling

### Week 2: UI & Polish
- **Day 6-7:** UI components
  - Algorithm selector
  - Pareto front viewer
  - Objective dashboard

- **Day 8-9:** Testing & refinement
  - E2E tests
  - User testing
  - Parameter tuning

- **Day 10:** Documentation & deployment
  - Update docs
  - Deploy with feature flags
  - Monitor performance

---

## Success Metrics

### Performance Targets
- **Tabu Search:** <500ms for 24 operators × 5 days
- **Pareto Front:** Generate 3-5 non-dominated solutions in <2s
- **Schedule Quality:** 5-10% improvement over greedy alone

### Quality Metrics
- **Fairness:** ≤20% workload std deviation
- **Skill Match:** ≥95% perfect matches
- **Constraint Violations:** 0 hard constraint violations
- **User Satisfaction:** ≥80% prefer enhanced algorithms

---

## Phase 2: CP-SAT Integration (Future)

### Option A: Python Backend Service

**Architecture:**
```
React Frontend (TypeScript)
     ↓ HTTP/WebSocket
Python FastAPI Backend
     ↓ uses
Google OR-Tools (Python)
```

**Pros:**
- ✅ Full OR-Tools CP-SAT functionality
- ✅ Proven optimality guarantees
- ✅ Industry-standard approach

**Cons:**
- ❌ Requires backend infrastructure
- ❌ Deployment complexity
- ❌ Network latency

### Option B: WebAssembly Compilation

**Approach:** Compile OR-Tools C++ to WASM

**Pros:**
- ✅ Client-side execution
- ✅ No backend needed

**Cons:**
- ❌ Complex build process
- ❌ Large bundle size (several MB)
- ❌ Unproven approach

### Option C: JavaScript Constraint Solver

**Alternatives:**
- [constraint-solver](https://www.npmjs.com/package/constraint-solver) - Pure JS CSP solver
- [cassowary.js](https://github.com/slightlyoff/cassowary.js) - Linear constraint solver
- Custom implementation

**Pros:**
- ✅ Pure JavaScript
- ✅ Client-side

**Cons:**
- ❌ Not as powerful as OR-Tools
- ❌ May not handle complexity

### Recommendation for Phase 2

**If backend is acceptable:** Option A (Python FastAPI + OR-Tools)
**If must stay client-side:** Evaluate Option C libraries first

**Timeline:** Q1 2026 (after Phase 1 validation)

---

## Risk Mitigation

### Risk 1: Performance Regression
**Mitigation:**
- Feature flags for gradual rollout
- Performance monitoring
- Hard timeout limits (500ms)
- Fallback to greedy if timeout

### Risk 2: Increased Complexity
**Mitigation:**
- Comprehensive unit tests (target: 90% coverage)
- Clear code documentation
- Algorithm comparison utilities
- Keep greedy as simple default

### Risk 3: User Confusion
**Mitigation:**
- Default to "Auto (Recommended)" mode
- Tooltips explaining algorithms
- Visual objective comparisons
- User guide with examples

---

## Testing Strategy

### Unit Tests
```typescript
describe('TabuSearchOptimizer', () => {
  test('improves schedule quality over greedy alone', () => {
    const greedy = generateSmartSchedule(mockData);
    const enhanced = refineScheduleWithTabuSearch(greedy, mockData);
    expect(enhanced.objectives.totalScore).toBeGreaterThan(greedy.objectives.totalScore);
  });

  test('respects tabu list constraints', () => {
    // Test tabu memory
  });

  test('applies aspiration criterion correctly', () => {
    // Test override logic
  });
});

describe('MultiObjectiveOptimizer', () => {
  test('finds non-dominated solutions', () => {
    const schedules = generateParetoSchedules(mockData);
    schedules.forEach(scheduleA => {
      const dominated = schedules.some(scheduleB =>
        strictlyDominates(scheduleB.objectives, scheduleA.objectives)
      );
      expect(dominated).toBe(false);
    });
  });
});
```

### Integration Tests
```typescript
describe('Enhanced Scheduling Service', () => {
  test('generates valid schedules with tabu search', () => {
    const result = generateOptimizedSchedule({
      ...mockData,
      rules: { ...DEFAULT_RULES, algorithm: 'greedy-tabu' },
    });
    expect(validateSchedule(result)).toHaveLength(0); // No warnings
  });

  test('pareto front contains diverse solutions', () => {
    const results = generateOptimizedSchedule({
      ...mockData,
      rules: { ...DEFAULT_RULES, algorithm: 'multi-objective' },
    });
    expect(results).toHaveLength(3); // At least 3 options
    expect(objectivesAreDiverse(results)).toBe(true);
  });
});
```

---

## Rollout Plan

### Phase 1a: Internal Testing (Week 1)
- Deploy to dev environment
- Test with real scheduling scenarios
- Collect performance metrics
- Fix critical bugs

### Phase 1b: Beta Testing (Week 2)
- Enable for 10% of users via feature flag
- Collect feedback
- Monitor error rates
- A/B test quality improvements

### Phase 1c: Full Rollout (Week 3)
- Gradually increase to 50% → 100%
- Make enhanced algorithm default
- Update documentation
- Announce new features

---

## Documentation Updates

### For Users
- Add "Algorithm Comparison" guide
- Update Planning Modal screenshots
- Explain objective metrics
- Provide best practices

### For Developers
- Architecture decision records (ADRs)
- Algorithm implementation notes
- Performance tuning guide
- Extension points for future algorithms

---

## Conclusion

Phase 1 focuses on **immediately implementable improvements** that don't require architectural changes:
- ✅ Tabu Search for 5-10% quality boost
- ✅ Multi-objective for better user control
- ✅ Pure TypeScript, client-side compatible

Phase 2 (CP-SAT) remains a future goal requiring backend infrastructure but offering 10-20% additional improvement with optimality guarantees.

**Next Steps:**
1. ✅ Get approval on Phase 1 plan
2. 🔲 Begin Tabu Search implementation
3. 🔲 Build multi-objective framework
4. 🔲 Create UI components
5. 🔲 Test and deploy

---

**Document Status:** Ready for Implementation
**Estimated Effort:** 2 weeks (Phase 1)
**Expected ROI:** High (immediate value, no infrastructure changes)
