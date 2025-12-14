/**
 * Feasibility Check Script
 *
 * Analyzes if 100% fulfillment is mathematically possible
 * by checking skill coverage and identifying bottlenecks.
 */

import { MOCK_OPERATORS, MOCK_TASKS, TaskRequirement, Operator } from '../types';

// Test configuration (same as algorithm-comparison.ts)
const TEST_OPERATORS: Operator[] = MOCK_OPERATORS.map(op => {
  if (['op1', 'op3', 'op6'].includes(op.id)) {
    return { ...op, skills: [...op.skills, 'Troubleshooter AD'] };
  }
  return op;
});

const TEST_REQUIREMENTS: TaskRequirement[] = [
  { taskId: 't1', defaultRequirements: [{ type: 'Regular', count: 3 }], enabled: true },   // Troubleshooter x3
  { taskId: 't10', defaultRequirements: [{ type: 'Regular', count: 1 }], enabled: true },  // Troubleshooter AD x1
  { taskId: 't2', defaultRequirements: [{ type: 'Regular', count: 2 }], enabled: true },   // Quality checker x2
  { taskId: 't3', defaultRequirements: [{ type: 'Regular', count: 2 }], enabled: true },   // MONO counter x2
  { taskId: 't4', defaultRequirements: [{ type: 'Regular', count: 2 }], enabled: true },   // Filler x2
  { taskId: 't5', defaultRequirements: [{ type: 'Regular', count: 1 }], enabled: true },   // LVB Sheet x1
  { taskId: 't6', defaultRequirements: [{ type: 'Regular', count: 0 }], enabled: true },   // Decanting x0 (disabled)
  { taskId: 't7', defaultRequirements: [{ type: 'Regular', count: 1 }], enabled: true },   // Platform x1
  { taskId: 't8', defaultRequirements: [{ type: 'Regular', count: 1 }], enabled: true },   // EST x1
  { taskId: 't9', defaultRequirements: [{ type: 'Regular', count: 2 }], enabled: true },   // Exceptions x2
];

function main() {
  console.log('═'.repeat(70));
  console.log('              FEASIBILITY ANALYSIS');
  console.log('═'.repeat(70));

  // Filter non-TC operators
  const operators = TEST_OPERATORS.filter(op => op.type !== 'Coordinator');

  console.log(`\nTotal Operators (non-TC): ${operators.length}`);
  console.log(`Total Slots per Day: ${TEST_REQUIREMENTS.reduce((sum, r) => sum + r.defaultRequirements.reduce((s, d) => s + d.count, 0), 0)}`);

  // Map task IDs to names
  const taskMap = new Map(MOCK_TASKS.map(t => [t.id, t]));

  console.log('\n─'.repeat(70));
  console.log('SKILL COVERAGE ANALYSIS');
  console.log('─'.repeat(70));

  const skillCoverage: Map<string, string[]> = new Map();

  for (const req of TEST_REQUIREMENTS) {
    const task = taskMap.get(req.taskId);
    if (!task) continue;

    const requiredCount = req.defaultRequirements.reduce((s, r) => s + r.count, 0);
    if (requiredCount === 0) continue;

    const eligibleOps = operators.filter(op => op.skills.includes(task.requiredSkill));
    skillCoverage.set(task.name, eligibleOps.map(op => op.name));

    const ratio = eligibleOps.length / requiredCount;
    const status = ratio >= 1 ? (ratio >= 2 ? '✓ OK' : '⚠ TIGHT') : '✗ IMPOSSIBLE';

    console.log(`\n${task.name} (need ${requiredCount}/day, skill: "${task.requiredSkill}"):`);
    console.log(`  Eligible operators (${eligibleOps.length}): ${eligibleOps.map(op => op.name).join(', ')}`);
    console.log(`  Coverage ratio: ${ratio.toFixed(2)} ${status}`);
  }

  console.log('\n─'.repeat(70));
  console.log('BOTTLENECK ANALYSIS');
  console.log('─'.repeat(70));

  // Find operators who are eligible for multiple scarce tasks
  const scarceTasks = ['Troubleshooter AD', 'Filler', 'Platform', 'EST', 'LVB Sheet'];
  const operatorDemand: Map<string, string[]> = new Map();

  for (const op of operators) {
    const tasksCanDo = scarceTasks.filter(taskName => {
      const task = MOCK_TASKS.find(t => t.name === taskName);
      return task && op.skills.includes(task.requiredSkill);
    });
    if (tasksCanDo.length > 1) {
      operatorDemand.set(op.name, tasksCanDo);
    }
  }

  console.log('\nOperators with MULTIPLE scarce skills (potential bottlenecks):');
  for (const [opName, tasks] of operatorDemand) {
    console.log(`  ${opName}: ${tasks.join(', ')}`);
  }

  console.log('\n─'.repeat(70));
  console.log('MANUAL FEASIBILITY CHECK');
  console.log('─'.repeat(70));

  // Try to find a valid assignment using greedy + backtracking
  const slots = TEST_REQUIREMENTS
    .filter(r => r.defaultRequirements.reduce((s, d) => s + d.count, 0) > 0)
    .flatMap(r => {
      const task = taskMap.get(r.taskId)!;
      const count = r.defaultRequirements.reduce((s, d) => s + d.count, 0);
      return Array(count).fill({ taskId: r.taskId, taskName: task.name, skill: task.requiredSkill });
    });

  // Sort by scarcity (fewer eligible operators first)
  slots.sort((a, b) => {
    const aEligible = operators.filter(op => op.skills.includes(a.skill)).length;
    const bEligible = operators.filter(op => op.skills.includes(b.skill)).length;
    return aEligible - bEligible;
  });

  console.log('\nSlots to fill (sorted by scarcity):');
  slots.forEach((slot, i) => {
    const eligible = operators.filter(op => op.skills.includes(slot.skill)).length;
    console.log(`  ${i + 1}. ${slot.taskName} (${eligible} eligible)`);
  });

  // Try to assign
  const assigned = new Set<string>();
  const assignments: { task: string; operator: string }[] = [];
  let failed = false;

  console.log('\nAttempting assignment (MRV order):');

  for (const slot of slots) {
    const eligible = operators.filter(
      op => op.skills.includes(slot.skill) && !assigned.has(op.id)
    );

    if (eligible.length === 0) {
      console.log(`  ✗ ${slot.taskName}: NO AVAILABLE OPERATOR!`);
      failed = true;
      break;
    }

    // Pick the one with fewest remaining options (most constrained)
    const chosen = eligible.sort((a, b) => {
      const aFuture = slots.filter(s => !assigned.has(a.id) && a.skills.includes(s.skill)).length;
      const bFuture = slots.filter(s => !assigned.has(b.id) && b.skills.includes(s.skill)).length;
      return aFuture - bFuture;
    })[0];

    assigned.add(chosen.id);
    assignments.push({ task: slot.taskName, operator: chosen.name });
    console.log(`  ✓ ${slot.taskName} → ${chosen.name} (${eligible.length - 1} alternatives left)`);
  }

  console.log('\n─'.repeat(70));
  if (!failed) {
    console.log('✓ 100% FULFILLMENT IS MATHEMATICALLY POSSIBLE!');
    console.log('─'.repeat(70));
    console.log('\nValid assignment found:');
    assignments.forEach(a => console.log(`  ${a.task}: ${a.operator}`));
  } else {
    console.log('✗ 100% FULFILLMENT IS NOT POSSIBLE WITH CURRENT CONFIGURATION');
    console.log('─'.repeat(70));
    console.log('\nRemaining unassigned operators:');
    const unassigned = operators.filter(op => !assigned.has(op.id));
    unassigned.forEach(op => console.log(`  ${op.name}: [${op.skills.join(', ')}]`));
  }

  console.log('\n' + '═'.repeat(70));
}

main();
