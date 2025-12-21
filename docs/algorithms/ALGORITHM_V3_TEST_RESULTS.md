# Algorithm Comparison: V1 vs V2 vs V3

**Test Date:** December 14, 2025
**Iterations:** 100 per algorithm
**Key Test:** Can algorithms handle multi-skill operators and reserve scarce skills?

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Iterations per algorithm | 100 |
| Days tested | Monday - Friday (5 days) |
| Total operators | 24 (19 Regular, 2 Flex, 3 Coordinators) |
| Total tasks | 14 |
| Operators with "Troubleshooter AD" skill | 3 (multi-skill, NOT dedicated) |

### Staffing Requirements

| Task | Operators/Day |
|------|---------------|
| Troubleshooter | 3 |
| Troubleshooter AD | 1 |
| Quality checker | 2 |
| MONO counter | 2 |
| Filler | 2 |
| LVB Sheet | 1 |
| Decanting | 0 (disabled) |
| Platform | 1 |
| EST | 1 |
| Exceptions | 2 |

**Total operators needed per day:** 15

---

## KEY RESULT: Troubleshooter AD Fulfillment

This is the critical test - can the algorithm achieve 100% fulfillment for a **scarce skill** when the only qualified operators **also have other common skills**?

| Algorithm | Troubleshooter AD Fulfillment | Result |
|-----------|-------------------------------|--------|
| V1 (Standard) | **65.8%** | FAIL |
| V2 (Experimental) | **53.2%** | FAIL |
| V3 (Enhanced) | **100.0%** | SUCCESS! |

### Why V1 and V2 Fail

V1 and V2 are **greedy algorithms** - they score operators based on:
- Skill match
- Workload balance
- Heavy task distribution
- Preferred tasks

But they **don't consider skill scarcity**. When an operator has both "Troubleshooter" and "Troubleshooter AD" skills, they might get assigned to Troubleshooter first (more common task), leaving Troubleshooter AD unfilled.

### Why V3 Succeeds

V3 uses **Constraint Propagation** with the **MRV (Minimum Remaining Values) heuristic**:

1. **Phase 1:** Identifies forced assignments where only N operators can fill N slots
2. **Phase 2:** Processes slots in priority order - scarce-skill tasks FIRST
3. **Phase 3:** Uses backtracking fallback for dead-ends

This ensures that operators with rare skills are **reserved** for those scarce tasks before being assigned to common tasks.

---

## Performance Comparison

| Metric | V1 (Standard) | V2 (Experimental) | V3 (Enhanced) | Winner |
|--------|---------------|-------------------|---------------|--------|
| Avg Execution Time | 1.23 ms | **1.02 ms** | 2.78 ms | V2 |
| Min Execution Time | 1.06 ms | **0.89 ms** | 2.40 ms | V2 |
| Max Execution Time | 3.41 ms | **2.26 ms** | 15.04 ms | V2 |

V3 is slower because constraint propagation and backtracking require more computation.

---

## Fulfillment Comparison

| Metric | V1 (Standard) | V2 (Experimental) | V3 (Enhanced) | Winner |
|--------|---------------|-------------------|---------------|--------|
| Success Rate (100% fill) | 0.0% | 0.0% | 0.0% | TIED |
| Avg Overall Fulfillment | 93.2% | 89.8% | **94.4%** | V3 |
| Troubleshooter AD | 65.8% | 53.2% | **100.0%** | V3 |

### Task-by-Task Fulfillment

| Task | V1 | V2 | V3 | Best |
|------|----|----|----|----|
| Troubleshooter | 100.0% | 100.0% | 100.0% | TIED |
| Troubleshooter AD | 65.8% | 53.2% | **100.0%** | **V3** |
| Quality checker | 99.9% | **100.0%** | 99.8% | V2 |
| MONO counter | 98.4% | 96.6% | **100.0%** | **V3** |
| Filler | **88.9%** | 72.4% | 74.2% | V1 |
| LVB Sheet | 92.8% | 89.8% | **100.0%** | **V3** |
| Decanting | 100.0% | 100.0% | 100.0% | TIED |
| Platform | **98.0%** | 95.6% | 83.8% | V1 |
| EST | 93.4% | 94.6% | **99.8%** | **V3** |
| Exceptions | 94.4% | **95.6%** | 86.8% | V2 |

---

## Quality Metrics

| Metric | V1 (Standard) | V2 (Experimental) | V3 (Enhanced) | Winner |
|--------|---------------|-------------------|---------------|--------|
| Avg Warnings | **0.00** | **0.00** | 4.91 | V1 & V2 |
| Avg Soft Violations | 11.26 | 8.07 | **5.40** | V3 |
| Avg Variety Score | 2.35 | **2.92** | 2.57 | V2 |

---

## Recommendations

### Use V3 (Enhanced) when:
- **Scarce skills must be 100% filled** (critical positions)
- You have operators with multiple skills (realistic scenario)
- Missing scarce-skill coverage is unacceptable

### Use V1 (Standard) when:
- Maximum overall coverage is needed
- All operators have single skills
- Speed is important

### Use V2 (Experimental) when:
- Speed is critical (real-time scheduling)
- Operator task variety is important
- You want fewer soft constraint violations

---

## Conclusion

**V3 (Enhanced) is the ONLY algorithm that correctly handles skill scarcity.**

With realistic multi-skill operators:
- V1 achieves only **65.8%** Troubleshooter AD fulfillment
- V2 achieves only **53.2%** Troubleshooter AD fulfillment
- V3 achieves **100%** Troubleshooter AD fulfillment

The constraint propagation approach in V3 ensures that operators with scarce skills are **reserved** for those tasks, solving the "skill stealing" problem in greedy algorithms.
