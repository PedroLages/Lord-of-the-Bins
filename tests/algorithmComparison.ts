/**
 * Algorithm Comparison Test Script
 *
 * Compares the performance of three scheduling algorithms:
 * 1. Greedy (baseline)
 * 2. Greedy + Tabu Search
 * 3. Multi-Objective (Pareto front)
 *
 * Usage: Run this in browser console after importing
 */

import { MOCK_OPERATORS, MOCK_TASKS } from '../types';
import { generateOptimizedSchedule, validateSchedule, type ScheduleRequestData, DEFAULT_RULES } from '../services/schedulingService';
import type { ScheduleWithObjectives } from '../services/scheduling/paretoFrontFinder';
import { calculateObjectives } from '../services/scheduling/objectiveCalculators';

// Test data setup
const testData: ScheduleRequestData = {
  operators: MOCK_OPERATORS,
  tasks: MOCK_TASKS,
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  rules: DEFAULT_RULES,
};

console.log('📊 Starting Algorithm Comparison Test');
console.log('=====================================\n');

console.log(`Test Configuration:
- Operators: ${testData.operators.length}
- Tasks: ${testData.tasks.length}
- Days: ${testData.days.length}
- Total Assignments Needed: ~${testData.operators.length * testData.days.length}
`);

// Test 1: Greedy Algorithm (Baseline)
console.log('🏃 Test 1: Greedy Algorithm (Baseline)');
console.log('----------------------------------------');
const greedyStart = performance.now();
const greedyResult = generateOptimizedSchedule({
  ...testData,
  rules: { ...DEFAULT_RULES, algorithm: 'greedy' },
});
const greedyEnd = performance.now();

const greedyObjectives = calculateObjectives(
  greedyResult,
  testData.operators,
  testData.tasks,
  testData.days
);

const greedyWarnings = validateSchedule(
  greedyResult.schedule,
  testData.operators,
  testData.tasks,
  testData.days
);

console.log(`✓ Execution Time: ${(greedyEnd - greedyStart).toFixed(2)}ms`);
console.log(`✓ Warnings: ${greedyWarnings.length}`);
console.log(`✓ Objective Scores:`);
console.log(`  - Fairness: ${greedyObjectives.fairness.toFixed(3)} (lower = better)`);
console.log(`  - Workload Balance: ${greedyObjectives.workloadBalance.toFixed(2)} tasks (lower = better)`);
console.log(`  - Skill Match: ${greedyObjectives.skillMatchScore.toFixed(1)}% (higher = better)`);
console.log(`  - Heavy Task Fairness: ${greedyObjectives.heavyTaskFairness.toFixed(3)} (lower = better)`);
console.log(`  - Schedule Variety: ${greedyObjectives.scheduleVariety.toFixed(2)} tasks/operator (higher = better)`);
console.log(`  - Total Score: ${greedyObjectives.totalScore.toFixed(1)}/100`);
console.log('');

// Test 2: Greedy + Tabu Search
console.log('🔍 Test 2: Greedy + Tabu Search');
console.log('----------------------------------------');
const tabuStart = performance.now();
const tabuResult = generateOptimizedSchedule({
  ...testData,
  rules: {
    ...DEFAULT_RULES,
    algorithm: 'greedy-tabu',
    tabuSearchIterations: 100,
    tabuListSize: 20,
  },
});
const tabuEnd = performance.now();

const tabuObjectives = calculateObjectives(
  tabuResult,
  testData.operators,
  testData.tasks,
  testData.days
);

const tabuWarnings = validateSchedule(
  tabuResult.schedule,
  testData.operators,
  testData.tasks,
  testData.days
);

const tabuImprovement = ((tabuObjectives.totalScore - greedyObjectives.totalScore) / greedyObjectives.totalScore * 100);

console.log(`✓ Execution Time: ${(tabuEnd - tabuStart).toFixed(2)}ms (${((tabuEnd - tabuStart) / (greedyEnd - greedyStart)).toFixed(1)}x slower)`);
console.log(`✓ Warnings: ${tabuWarnings.length}`);
console.log(`✓ Objective Scores:`);
console.log(`  - Fairness: ${tabuObjectives.fairness.toFixed(3)} (${tabuObjectives.fairness < greedyObjectives.fairness ? '✓ better' : '✗ worse'})`);
console.log(`  - Workload Balance: ${tabuObjectives.workloadBalance.toFixed(2)} tasks (${tabuObjectives.workloadBalance < greedyObjectives.workloadBalance ? '✓ better' : '✗ worse'})`);
console.log(`  - Skill Match: ${tabuObjectives.skillMatchScore.toFixed(1)}% (${tabuObjectives.skillMatchScore > greedyObjectives.skillMatchScore ? '✓ better' : '✗ worse'})`);
console.log(`  - Heavy Task Fairness: ${tabuObjectives.heavyTaskFairness.toFixed(3)} (${tabuObjectives.heavyTaskFairness < greedyObjectives.heavyTaskFairness ? '✓ better' : '✗ worse'})`);
console.log(`  - Schedule Variety: ${tabuObjectives.scheduleVariety.toFixed(2)} tasks/operator (${tabuObjectives.scheduleVariety > greedyObjectives.scheduleVariety ? '✓ better' : '✗ worse'})`);
console.log(`  - Total Score: ${tabuObjectives.totalScore.toFixed(1)}/100 (${tabuImprovement > 0 ? '+' : ''}${tabuImprovement.toFixed(2)}% improvement)`);
console.log('');

// Test 3: Multi-Objective (Pareto Front)
console.log('🎯 Test 3: Multi-Objective (Pareto Front)');
console.log('----------------------------------------');
const paretoStart = performance.now();
const paretoResults = generateOptimizedSchedule({
  ...testData,
  rules: {
    ...DEFAULT_RULES,
    algorithm: 'multi-objective',
    generateParetoFront: true,
  },
}) as ScheduleWithObjectives[];
const paretoEnd = performance.now();

console.log(`✓ Execution Time: ${(paretoEnd - paretoStart).toFixed(2)}ms`);
console.log(`✓ Pareto-Optimal Solutions Found: ${paretoResults.length}`);
console.log('');

paretoResults.forEach((result, index) => {
  const warnings = validateSchedule(
    result.schedule.schedule,
    testData.operators,
    testData.tasks,
    testData.days
  );

  console.log(`  Option ${index + 1} (ID: ${result.id}):`);
  console.log(`    - Fairness: ${result.objectives.fairness.toFixed(3)}`);
  console.log(`    - Workload Balance: ${result.objectives.workloadBalance.toFixed(2)} tasks`);
  console.log(`    - Skill Match: ${result.objectives.skillMatchScore.toFixed(1)}%`);
  console.log(`    - Heavy Task Fairness: ${result.objectives.heavyTaskFairness.toFixed(3)}`);
  console.log(`    - Schedule Variety: ${result.objectives.scheduleVariety.toFixed(2)} tasks/operator`);
  console.log(`    - Total Score: ${result.objectives.totalScore.toFixed(1)}/100`);
  console.log(`    - Warnings: ${warnings.length}`);
  console.log('');
});

// Summary Comparison
console.log('📈 Summary Comparison');
console.log('=====================================\n');

console.log('Performance:');
console.log(`  Greedy:             ${(greedyEnd - greedyStart).toFixed(2)}ms`);
console.log(`  Greedy + Tabu:      ${(tabuEnd - tabuStart).toFixed(2)}ms (${((tabuEnd - tabuStart) / (greedyEnd - greedyStart)).toFixed(1)}x)`);
console.log(`  Multi-Objective:    ${(paretoEnd - paretoStart).toFixed(2)}ms (${((paretoEnd - paretoStart) / (greedyEnd - greedyStart)).toFixed(1)}x)`);
console.log('');

console.log('Quality (Total Score):');
console.log(`  Greedy:             ${greedyObjectives.totalScore.toFixed(1)}/100 (baseline)`);
console.log(`  Greedy + Tabu:      ${tabuObjectives.totalScore.toFixed(1)}/100 (${tabuImprovement > 0 ? '+' : ''}${tabuImprovement.toFixed(2)}%)`);

const paretoScores = paretoResults.map(r => r.objectives.totalScore);
const paretoBest = Math.max(...paretoScores);
const paretoWorst = Math.min(...paretoScores);
const paretoAvg = paretoScores.reduce((a, b) => a + b, 0) / paretoScores.length;

console.log(`  Multi-Objective:`);
console.log(`    - Best:           ${paretoBest.toFixed(1)}/100`);
console.log(`    - Worst:          ${paretoWorst.toFixed(1)}/100`);
console.log(`    - Average:        ${paretoAvg.toFixed(1)}/100`);
console.log('');

console.log('Constraint Violations:');
console.log(`  Greedy:             ${greedyWarnings.length} warnings`);
console.log(`  Greedy + Tabu:      ${tabuWarnings.length} warnings`);
console.log(`  Multi-Objective:    ${paretoResults.map(r => validateSchedule(r.schedule.schedule, testData.operators, testData.tasks, testData.days).length).join(', ')} warnings`);
console.log('');

// Recommendations
console.log('💡 Recommendations');
console.log('=====================================\n');

if (tabuImprovement > 3) {
  console.log('✅ Tabu Search shows significant improvement (>3%)');
  console.log('   → Recommend enabling greedy-tabu as default algorithm');
} else if (tabuImprovement > 0) {
  console.log('✓ Tabu Search shows modest improvement');
  console.log('   → Consider enabling for weekly planning (non-time-critical)');
} else {
  console.log('⚠️ Tabu Search did not improve over greedy');
  console.log('   → May need parameter tuning or more iterations');
}

console.log('');

if (paretoResults.length >= 3) {
  console.log('✅ Multi-Objective successfully generated diverse options');
  console.log('   → Recommend showing Pareto front to users for weekly planning');
} else {
  console.log('⚠️ Multi-Objective generated fewer than 3 options');
  console.log('   → May need to increase candidate generation');
}

console.log('');
console.log('✅ Algorithm Comparison Test Complete!');
