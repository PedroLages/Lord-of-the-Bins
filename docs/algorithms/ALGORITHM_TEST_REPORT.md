# Scheduling Algorithm Comparison Report

**Test Date:** December 14, 2025
**Iterations:** 100 per algorithm
**Algorithms Tested:** V1 (Standard) vs V2 (Experimental)

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Iterations per algorithm | 100 |
| Days tested | Monday - Friday (5 days) |
| Total operators | 26 (21 Regular, 2 Flex, 3 Coordinators) |
| Total tasks | 14 |

### Test Data Modifications
- 3 operators (Alesja, Bruno, Ionel) have "Troubleshooter AD" skill added
- 2 dedicated AD Specialists added (ONLY have Troubleshooter AD skill)

### Staffing Requirements Used

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

## HARD RULE COMPLIANCE (Skill Matching)

### Result: 100% COMPLIANT

| Metric | V1 (Standard) | V2 (Experimental) |
|--------|---------------|-------------------|
| Skill Mismatch Warnings | **0** | **0** |
| Hard Rule Violations | **0** | **0** |

**Both algorithms perfectly enforce hard rules (skill matching).** No operator is ever assigned to a task they don't have the skill for.

---

## Results Summary

### Performance Metrics

| Metric | V1 (Standard) | V2 (Experimental) | Winner |
|--------|---------------|-------------------|--------|
| Avg Execution Time | 1.34 ms | **1.07 ms** | V2 |
| Min Execution Time | 1.14 ms | **0.92 ms** | V2 |
| Max Execution Time | 3.65 ms | **2.38 ms** | V2 |

### Fulfillment Metrics

| Metric | V1 (Standard) | V2 (Experimental) | Winner |
|--------|---------------|-------------------|--------|
| Success Rate (100% fill) | **8.0%** | 0.0% | V1 |
| Avg Overall Fulfillment | **97.2%** | 94.8% | V1 |
| Avg Total Assignments | **97.9** | 95.8 | V1 |

### Task-by-Task Fulfillment Rates

| Task | V1 (Standard) | V2 (Experimental) | Notes |
|------|---------------|-------------------|-------|
| Troubleshooter | 100.0% | 100.0% | Perfect |
| Troubleshooter AD | 100.0% | 100.0% | Perfect (with dedicated operators) |
| Quality checker | 100.0% | 100.0% | Perfect |
| MONO counter | **98.8%** | 97.6% | V1 better |
| Filler | **91.0%** | 75.1% | V1 significantly better |
| LVB Sheet | **94.4%** | 93.0% | V1 better |
| Decanting | 100.0% | 100.0% | Perfect (0 required) |
| Platform | **97.8%** | 95.2% | V1 better |
| EST | **95.0%** | 91.4% | V1 better |
| Exceptions | 95.3% | **95.9%** | V2 slightly better |

### Quality Metrics

| Metric | V1 (Standard) | V2 (Experimental) | Winner |
|--------|---------------|-------------------|--------|
| Avg Warnings | 0.00 | 0.00 | Tied |
| Avg Soft Constraint Violations | 11.97 | **8.20** | V2 |
| Avg Variety Score | 2.16 | **2.73** | V2 |

**Note:** Soft constraint violations are NOT hard rule violations. They measure:
- Consecutive heavy shifts (same operator doing Troubleshooter → Exceptions)
- Same task >2 days in a row

### Workload Distribution

| Metric | V1 (Standard) | V2 (Experimental) | Winner |
|--------|---------------|-------------------|--------|
| Min Assignments/Operator | 0.00 | 0.00 | Tied |
| Max Assignments/Operator | 5.00 | 5.00 | Tied |
| Avg Assignments/Operator | **3.60** | 3.51 | V1 |
| Std Deviation | **1.73** | 1.77 | V1 |

---

## Key Findings

### Hard Rules: Both Algorithms Are 100% Compliant
- **Skill matching is ALWAYS enforced** - operators are never assigned tasks without the required skill
- The `strictSkillMatching: true` setting ensures this is a hard constraint
- Both V1 and V2 had **zero warnings** for skill mismatches

### V1 (Standard) Advantages:
1. **Higher task fulfillment** - 97.2% vs 94.8% average
2. **8% full success rate** - achieved 100% fulfillment in 8/100 runs
3. **Better for critical tasks like Filler** - 91% vs 75%
4. **More balanced workload** - lower standard deviation

### V2 (Experimental) Advantages:
1. **20% faster execution** - 1.07ms vs 1.34ms average
2. **31% fewer soft constraint violations** - 8.20 vs 11.97
3. **26% higher variety score** - operators get more diverse tasks
4. **Better for Exceptions task** - 95.9% vs 95.3%

---

## Recommendations

### Use V1 (Standard) when:
- **Maximum task coverage is critical** (warehouses, hospitals, etc.)
- You need the highest possible fulfillment rate
- Specific tasks like Filler must be staffed consistently
- 8% chance of perfect schedules is valuable

### Use V2 (Experimental) when:
- **Speed is important** (real-time scheduling)
- **Operator satisfaction matters** (more task variety)
- You want to minimize rotation rule violations
- You can tolerate slightly lower fulfillment for better variety

---

## Conclusion

**Both algorithms correctly enforce hard rules (skill matching) at 100%.**

For overall schedule quality:
- **V1 is better for task fulfillment** (higher coverage, 8% perfect schedules)
- **V2 is better for operator experience** (faster, more variety, fewer soft violations)

The choice depends on your priority:
- **Coverage-first** → V1
- **Experience-first** → V2
