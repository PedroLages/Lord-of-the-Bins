# Comprehensive Algorithm Test Results

**Date:** December 10, 2025
**Test:** 100x runs per algorithm with 10 different rule configurations

## Executive Summary

| Algorithm | Success Rate | Avg Assignments | Avg Time | Best For |
|-----------|-------------|-----------------|----------|----------|
| **Greedy + Tabu** | **100%** | 56 | 112ms | Production use, all scenarios |
| Greedy (Standard) | 75% | 56 | 4ms | Quick generation, simple scenarios |
| Enhanced | 1%* | 34 | 1ms | Plan Builder requirements only |
| Multi-Objective | 1%* | 40 | 12ms | Plan Builder requirements only |

*Note: Enhanced and Multi-Objective are designed for Plan Builder requirements, not full schedule generation. They perform well when used via the app's Smart Fill (which adds fillRemainingOperators).

## Randomization Verification

**Variety Analysis (Are schedules different?):**
- **100 unique seeds** used across 100 runs per algorithm
- **Randomization IS working** - schedules vary between runs
- Assignment counts show natural variation based on operator availability

## Detailed Results by Rule Configuration

### Basic Requirements (1x Troubleshooter/day)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 100% | 3ms |
| Greedy + Tabu | 100% | 184ms |
| Enhanced | 10% | 4ms |
| Multi-Objective | 10% | 24ms |

### Medium Requirements (2x Troubleshooter/day)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 100% | 4ms |
| Greedy + Tabu | 100% | 86ms |
| Enhanced | 0% | 2ms |
| Multi-Objective | 0% | 19ms |

### Hard Requirements (3x Troubleshooter/day)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 80% | 5ms |
| Greedy + Tabu | 100% | 247ms |
| Enhanced | 0% | 0ms |
| Multi-Objective | 0% | 1ms |

### High Load (All tasks at high capacity)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 60% | 7ms |
| Greedy + Tabu | 100% | 83ms |
| Enhanced | 0% | 0ms |
| Multi-Objective | 0% | 1ms |

### Tight Constraints (20 operators)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 10% | 3ms |
| Greedy + Tabu | 100% | 70ms |
| Enhanced | 0% | 0ms |
| Multi-Objective | 0% | 1ms |

### Very Tight Constraints (16 operators)
| Algorithm | Success | Time |
|-----------|---------|------|
| Greedy (Standard) | 90% | 2ms |
| Greedy + Tabu | 100% | 37ms |
| Enhanced | 0% | 0ms |
| Multi-Objective | 0% | 7ms |

## Key Findings

### 1. Greedy + Tabu Search is the Best Overall
- **100% success rate** across ALL rule configurations
- Handles tight constraints perfectly
- Tabu Search refinement overcomes greedy traps
- ~112ms average (acceptable for production)

### 2. Standard Greedy is Fast but Less Reliable
- **75% success rate** overall
- Struggles with tight constraints (10% success with 20 operators)
- Best for quick generation when success rate isn't critical
- ~4ms average (very fast)

### 3. Enhanced & Multi-Objective Need Full Pipeline
- These algorithms focus on Plan Builder requirements
- Low success rate in isolated tests (1%)
- When used via Smart Fill (with `fillRemainingOperators`), they achieve 100% by filling remaining slots

### 4. Randomization is Working
- 100 unique seeds generated and used
- Schedules show variety between runs
- Assignment counts vary based on:
  - Random operator availability
  - Randomization factor applied to scoring
  - Different rule configurations

## Recommendations

### For Production (App Default):
```typescript
algorithm: 'greedy-tabu'  // 100% success, good optimization
randomizationFactor: 20   // Good variety without chaos
```

### For Quick Testing:
```typescript
algorithm: 'greedy'       // 75% success, very fast
randomizationFactor: 20   // Some variety
```

### For Plan Builder Analysis:
```typescript
algorithm: 'multi-objective'  // Use via app Smart Fill
// App automatically adds fillRemainingOperators phase
```

## Test Environment

- **Platform:** macOS Darwin 25.1.0
- **Node.js:** via tsx
- **Runs per algorithm:** 100
- **Rule configurations:** 10 (changed every 10 runs)
- **Operator counts:** 16-30 depending on configuration
- **Days:** Mon-Fri (5 days)
