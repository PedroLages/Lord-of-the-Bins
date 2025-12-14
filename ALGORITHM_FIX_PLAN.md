# Algorithm Fix Plan - Lord of the Bins

**Created:** December 9, 2025
**Status:** ✅ COMPLETE
**Goal:** Fix and improve scheduling algorithm incrementally

---

## Quick Reference

| Phase | Fix | Status | Time Est. |
|-------|-----|--------|-----------|
| 1 | Fix #1: Score-based enforcement (add operators) | ✅ Complete | 1.5h |
| 1 | Fix #2: Score-based removal | ✅ Complete | 1h |
| 1 | Phase 1 Integration Test | ✅ Complete | 30min |
| 2 | Fix #3: Type fallback logic | ✅ Complete | 45min |
| 2 | Fix #4: Boost preferred tasks weight | ✅ Complete | 30min |
| 3 | Fix #5: Deterministic randomization | ✅ Complete | 45min |
| 3 | Fix #6: Integrate Plan Builder into greedy | ✅ Complete | 1h |

---

## Success Metrics

```
✅ Plan Builder assigns exactly requested count
✅ Operators with preferred tasks get them when possible
✅ Workload distribution is fair (similar task counts)
✅ No skill mismatches
✅ Execution time < 100ms
```

---

## Phase 1: Fix Critical Logic Issues

### Fix #1: Score-Based Enforcement (Adding Operators) ⏳

**File:** `services/schedulingService.ts`
**Lines:** 1055-1077

**Problem:**
```typescript
// Currently takes FIRST N operators without scoring:
for (let i = 0; i < Math.min(needed, unassignedOperators.length); i++) {
  const operator = unassignedOperators[i]; // No scoring!
}
```

**Solution:**
- Score all eligible operators using `calculateOperatorTaskScore()`
- Sort by score descending
- Select top N operators
- Add console logging for debugging

**Changes Required:**
1. Create simplified scoring function for enforcement context
2. Modify operator selection to use scores
3. Add detailed console logging

**Test Cases:**
- [ ] 3 Troubleshooters: Best candidates selected
- [ ] Operators with preferences prioritized
- [ ] Workload balanced across operators

---

### Fix #2: Score-Based Removal ⬜

**File:** `services/schedulingService.ts`
**Lines:** 1029-1049

**Problem:**
```typescript
// Only checks skill match for removal:
const matchA = opA.skills.includes(task.requiredSkill) ? 1 : 0;
// Ignores workload, preferences, etc.
```

**Solution:**
- Score all current assignments
- Remove lowest-scored operators
- Consider workload and preferences

**Test Cases:**
- [ ] Excess operators: Lowest-scored removed
- [ ] Operators with preferences kept
- [ ] Workload remains balanced

---

## Phase 2: Enhance Robustness

### Fix #3: Type Fallback Logic ⬜

**Problem:** Fails when exact operator type unavailable

**Solution:** Allow Regular as fallback for Flex requirements (with warning)

### Fix #4: Boost Preferred Tasks Weight ⬜

**Problem:** +20 score too weak vs +500 Plan Builder boost

**Solution:** Increase to +100-150

---

## Phase 3: Polish (Optional)

### Fix #5: Deterministic Randomization ✅

**Problem:** Different results each Smart Fill

**Solution:** Replaced `Math.random()` with deterministic hash function based on operatorId + taskId + day

**Implementation:**

- Created `deterministicHash()` function using string hashing with prime multiplication
- Hash produces consistent 0-1 value for same inputs
- Applied to sorting tiebreaker when scores are equal

### Fix #6: Plan Builder Integration ⬜

**Problem:** Two-phase disconnect

**Solution:** Make greedy aware of exact requirements (complex)

---

## Testing Checklist

### Phase 1 Tests
- [ ] Test 1: Exact count match (3 Troubleshooters)
- [ ] Test 2: Overstaffing removal
- [ ] Test 3: Understaffing addition
- [ ] Test 4: Preferred tasks respected
- [ ] Test 5: Workload fairness

### Phase 2 Tests
- [ ] Test 6: Type fallback (Flex → Regular)
- [ ] Test 7: Preferred tasks priority boost

### Final Validation
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Performance < 100ms
- [ ] All constraints validated

---

## Progress Log

### December 9, 2025

**Session Start:** Beginning Phase 1, Fix #1

**Fix #1 Complete:** Added `scoreOperatorForEnforcement()` function with:
- Preferred tasks: +100
- Below avg workload: +15
- Above avg workload: -20
- Exact type match: +10
- Specialist (≤3 skills): +5
- Deterministic tiebreaker using name hash

**Fix #2 Complete:** Modified removal logic to use same scoring function, removes lowest-scored operators instead of simple skill check.

**Phase 1 Test Results (Playwright):**
```
✅ Scoring working correctly:
   → Javier: 125.9 [Below avg workload, Exact Regular match]
   → Yonay: 125.8 [Below avg workload, Exact Regular match]
✅ Operators selected by highest score
✅ "Plan Builder Requirements Satisfied" toast appeared
✅ 95 assignments generated, no conflicts
```

**Fix #3 Complete:** Type fallback logic added:
- First tries exact type match (Flex)
- Falls back to Regular if not enough Flex available
- Fallback operators get -5 penalty so exact matches preferred
- Warning logged when fallback used

**Fix #4 Complete:** Boosted preferred tasks weight:
- Main scoring: +20 → +100
- Now matches enforcement scoring weight
- Should significantly improve preference respect in greedy phase

**Phase 2 Test Results (Playwright):**
```
Test: 5 Flex operators for Exceptions (only 2 Flex available)
✅ "⚠️ Not enough Flex operators, allowing Regular as fallback"
✅ Scoring shows "Type fallback" in reasons for Regular operators
✅ Pedro: 115.6 [Below avg workload, Specialist, Type fallback]
✅ Yonay: 110.8 [Below avg workload, Type fallback]
✅ Regular operators successfully used as fallback
```

---

## Phase 2 Complete - All Fixes Implemented

---

**Fix #5 Complete:** Deterministic randomization implemented:

- Added `deterministicHash(operatorId, taskId, day)` function
- Uses string hashing: `((hash << 5) - hash) + charCode`
- Normalizes to 0-1 range for variety factor
- Tested: Two consecutive Smart Fills produce **identical** 95 assignments
- Verified operator scoring order is consistent across runs

**Phase 3 Test Results (Playwright):**

```text
Run 1: Smart Fill → 95 assignments
Run 2: Clear → Smart Fill → 95 assignments
✅ All assignments IDENTICAL between runs
✅ Determinism verified for:
   - Alesja: QC, QC, MONO, -, LVB (both runs)
   - Maha: Tbl, LVB, Fil, Tbl, Fil (both runs)
   - Pedro: Tbl, Tbl, Exc, MONO, MONO (both runs)
   - Yonay: Exc, Plat, Tbl, TblAD, Tbl (both runs)
```

---

**Fix #6 Complete:** Plan Builder integrated into greedy algorithm:

**Root Cause Found:**
- When Smart Fill ran, new assignments were applied ADDITIVELY to existing schedule
- Old assignments (from before Plan Builder limits) persisted even when algorithm didn't generate them
- This caused "needs 3 but has 4" violations after running Smart Fill

**Solution Implemented:**
1. Modified `App.tsx` to clear ALL non-locked/non-pinned assignments BEFORE applying new results
2. Applied fix to both Smart Fill button and Plan Builder modal
3. Ensures stale assignments don't persist when Plan Builder limits change

**Files Modified:**
- `App.tsx` - Lines 1225-1241 and 1404-1418 (schedule application logic)
- `services/schedulingService.ts` - Lines 336-369 (greedy loop Plan Builder checks)

**Test Results (Playwright):**
```text
✅ Console: "[Plan Builder] Mon: Troubleshooter has exactly 3/3 ✅" (all days)
✅ Toast: "Plan Builder Requirements Satisfied - All requirements are now met!"
✅ No purple violation indicators
✅ 95 assignments generated with no conflicts
```

---

## Phase 3 Complete - All Algorithm Fixes Implemented

---

## Notes & Decisions

- Fix #6 was simpler than estimated (1h vs 3-4h) because the main issue was in schedule application, not algorithm logic
- The greedy algorithm WAS respecting Plan Builder limits, but App.tsx was preserving old assignments

