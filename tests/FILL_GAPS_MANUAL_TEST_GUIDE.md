# Fill Gaps Feature - Manual Testing Guide

**Test Duration**: ~20 minutes
**Prerequisites**: Dev server running on http://localhost:3001

## Setup

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Login as Team Leader**:
   - Navigate to http://localhost:3001
   - Login with a Team Leader account (role must be "Team Leader")
   - You should see the Dashboard view

3. **Configure Task Requirements** (if not already done):
   - Navigate to Settings → Configuration
   - Scroll to "Task Staffing" section
   - Set requirements for each task (e.g., Picking: 3, Packing: 2, etc.)
   - Click "Save Changes"

## Test Scenarios

### ✅ Scenario 1: Empty Schedule Fill

**Steps**:
1. Navigate to Schedule view
2. Ensure you're viewing a fresh week (or clear existing assignments)
3. Open browser console (F12 → Console tab)
4. Click "Fill Gaps" button
5. Wait for preview modal to appear

**Expected Results**:
- ✅ Preview modal shows "Fill Gaps Preview"
- ✅ Statistics section shows:
  - Filled Cells: [should be > 0]
  - Unfillable Gaps: [depends on skills/requirements]
  - Rules Followed: [percentage]
- ✅ Assignments table shows filled cells with task names and colors
- ✅ Console shows `[Fill Gaps]` log messages
- ✅ No TypeScript or runtime errors in console

**Screenshot**: Save as `fill-gaps-empty-schedule.png`

---

### ✅ Scenario 2: Partial Schedule Fill

**Steps**:
1. Manually assign 2-3 operators to tasks on Monday
2. Leave Tuesday-Friday empty
3. Click "Fill Gaps"
4. Review preview modal

**Expected Results**:
- ✅ Monday assignments do NOT appear in preview (already assigned)
- ✅ Only Tuesday-Friday gaps are filled
- ✅ Task history builds correctly from Monday assignments
- ✅ Soft rules consider Monday assignments when scoring new cells

**Screenshot**: Save as `fill-gaps-partial-schedule.png`

---

### ✅ Scenario 3: Locked Assignment Respect

**Steps**:
1. Create some assignments
2. Lock 2-3 cells by clicking the lock icon
3. Click "Fill Gaps"
4. Verify locked cells don't appear in preview

**Expected Results**:
- ✅ Locked cells are NOT in the Fill Gaps preview
- ✅ Locked assignments remain exactly as they were
- ✅ Fill Gaps works around locked cells
- ✅ Console shows: `Skipped locked cell: [operator] on [day]`

**Screenshot**: Save as `fill-gaps-locked-respect.png`

---

### ✅ Scenario 4: Skill Mismatch Handling

**Steps**:
1. Go to Team → Edit an operator
2. Remove all skills except one (e.g., only "Outbound")
3. Ensure task requirements include tasks requiring other skills
4. Navigate to Schedule → Fill Gaps
5. Check "Unfillable Gaps" section in preview

**Expected Results**:
- ✅ Operator appears in "Unfillable Gaps" section
- ✅ Reason: "No tasks match operator skills"
- ✅ Console shows: `[Fill Gaps] Operator X: No eligible tasks (skills: Outbound)`
- ✅ Filled Cells count doesn't include this operator

**Screenshot**: Save as `fill-gaps-skill-mismatch.png`

---

### ✅ Scenario 5: Soft Rule - Avoid Consecutive Same Task

**Steps**:
1. Enable "Avoid Consecutive Days" soft rule in Fill Gaps Settings
2. Manually assign Operator A to "Picking" on Monday
3. Click "Fill Gaps"
4. Hover over Tuesday assignment for Operator A

**Expected Results**:
- ✅ Algorithm prefers different task on Tuesday (if operator has multiple skills)
- ✅ If only one skill available, same task is assigned
- ✅ If consecutive same task: ⚠️ icon appears
- ✅ Tooltip shows: "Breaks soft rule: avoid-consecutive-same-task"
- ✅ Preview highlights broken rules

**Screenshot**: Save as `fill-gaps-soft-rule-consecutive.png`

---

### ✅ Scenario 6: Apply and Validate

**Steps**:
1. Click "Fill Gaps"
2. Review preview (check scores, stats, broken rules)
3. Click "Apply Changes" button
4. Observe UI updates

**Expected Results**:
- ✅ Schedule updates with new assignments immediately
- ✅ Toast notification: "X gaps filled in the schedule"
- ✅ Preview modal closes
- ✅ Schedule warnings panel updates (if any conflicts exist)
- ✅ Validation runs automatically
- ✅ Can undo changes if needed

**Screenshot**: Save as `fill-gaps-after-apply.png`

---

### ✅ Scenario 7: Task Requirements Not Configured

**Steps**:
1. Go to Settings → Configuration → Task Staffing
2. Set all Task Requirements to 0
3. Navigate to Schedule view
4. Click "Fill Gaps"

**Expected Results**:
- ✅ Warning toast appears
- ✅ Message: "Configure Task Staffing requirements in Settings → Configuration to use Fill Gaps."
- ✅ Toast duration: 6 seconds
- ✅ No preview modal shown
- ✅ Console log: `[Fill Gaps] Skipping tasks without requirements: [all tasks]`
- ✅ No errors in console

**Screenshot**: Save as `fill-gaps-no-requirements.png`

---

### ✅ Scenario 8: Browser Console Validation

**Steps**:
1. Open browser console (F12)
2. Clear console
3. Click "Fill Gaps"
4. Review console messages

**Expected Results**:
- ✅ No TypeScript errors
- ✅ No runtime errors (Uncaught, undefined, etc.)
- ✅ `[Fill Gaps]` log messages appear
- ✅ Console shows:
  - Algorithm start message
  - Tasks being considered
  - Operators being processed
  - Gaps found count
  - Filled cells count

**Example Console Output**:
```
[Fill Gaps] Starting Fill Gaps algorithm...
[Fill Gaps] Processing 20 operators × 5 days = 100 cells
[Fill Gaps] Operator Alice: Eligible tasks = [Picking, Packing, Sorting]
[Fill Gaps] Assigning Alice → Picking (score: 45)
[Fill Gaps] Completed: 72 cells filled, 5 unfillable gaps
```

---

### ✅ Scenario 9: Performance Check

**Steps**:
1. Open browser DevTools → Performance tab
2. Start recording
3. Click "Fill Gaps"
4. Wait for preview to appear
5. Stop recording

**Expected Results**:
- ✅ Algorithm runtime < 1 second (1000ms)
- ✅ UI remains responsive during processing
- ✅ No infinite loops or freezing
- ✅ Preview modal appears within 2 seconds

**Typical Performance**:
- 30 operators × 5 days = 150 cells
- Algorithm runtime: 300-800ms
- Preview render: 100-200ms
- Total time: < 1 second

---

## Edge Cases

### Edge Case 1: All Operators Lack Required Skills

**Setup**: Configure tasks requiring skills that no operators have

**Expected**:
- ✅ All gaps listed as unfillable
- ✅ Reason: "No tasks match operator skills"
- ✅ Filled Cells = 0
- ✅ Unfillable Gaps > 0

---

### Edge Case 2: Single Operator, Single Task

**Setup**: Delete all operators except one, and ensure they only have one skill

**Expected**:
- ✅ All days assigned same task (no variety possible)
- ✅ Multiple ⚠️ warnings for broken soft rules
- ✅ Still valid assignment (no hard constraint violations)
- ✅ Preview shows:
  - Broken rule: consecutive-same-task (4 violations)
  - Broken rule: task-variety (5 violations)

---

### Edge Case 3: All Tasks at Capacity

**Setup**: Manually fill all task requirements for all days

**Expected**:
- ✅ No gaps found
- ✅ Filled Cells = 0
- ✅ Unfillable Gaps = 0
- ✅ Toast: "0 gaps filled"
- ✅ Preview modal still shown with stats

---

## Testing Checklist

### Core Functionality
- [ ] Scenario 1: Empty Schedule Fill
- [ ] Scenario 2: Partial Schedule Fill
- [ ] Scenario 3: Locked Assignment Respect
- [ ] Scenario 4: Skill Mismatch Handling

### Soft Rules
- [ ] Scenario 5: Avoid Consecutive Same Task
- [ ] Task Variety rule works
- [ ] Workload Balance rule works
- [ ] Avoid Consecutive Heavy rule works

### UI/UX
- [ ] Scenario 6: Apply and Validate
- [ ] Scenario 7: No Task Requirements Warning
- [ ] Preview modal structure is correct
- [ ] Stats display accurately
- [ ] Tooltips show broken rules

### Performance & Quality
- [ ] Scenario 8: Browser Console Validation
- [ ] Scenario 9: Performance Check
- [ ] No memory leaks
- [ ] No infinite loops

### Edge Cases
- [ ] All operators lack skills
- [ ] Single operator, single task
- [ ] All tasks at capacity
- [ ] Partial availability
- [ ] Conflicting soft rules

---

## Troubleshooting

### Issue: Preview Modal Doesn't Appear

**Possible Causes**:
- Task Requirements not configured
- All operators unavailable or lacking skills
- JavaScript error in console

**Fix**:
- Check console for errors
- Verify Task Staffing requirements in Settings
- Check operator skills match task requirements

### Issue: No Gaps Filled

**Possible Causes**:
- All cells already assigned
- All operators lack required skills
- All tasks at capacity

**Fix**:
- Verify schedule has empty cells
- Check operator skills
- Review task requirements

### Issue: Soft Rules Always Broken

**Possible Causes**:
- Limited operator skills
- Task requirements too high
- Not enough operator variety

**Fix**:
- This is expected with limited operators/skills
- Soft rules are guidelines, not hard constraints
- Preview shows which rules couldn't be followed

---

## Success Criteria

✅ **Pass**: All 9 scenarios work as expected
✅ **Pass**: No TypeScript or runtime errors
✅ **Pass**: Performance < 1 second for 30 operators
✅ **Pass**: Edge cases handled gracefully

---

## Test Report

**Date**: _____________
**Tester**: _____________
**Environment**: Dev server on localhost:3001
**Browser**: _____________

**Results**:
- Scenarios Passed: ____ / 9
- Edge Cases Passed: ____ / 3
- Console Errors: ____ (should be 0)
- Performance: ____ ms (should be < 1000ms)

**Notes**:
_____________________________________________
_____________________________________________

---

**Next Steps**: If all tests pass, proceed with Week 2 (Conflict Resolution Wizard)
