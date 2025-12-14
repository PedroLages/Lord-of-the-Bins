/**
 * Browser Console Test for Algorithm Comparison
 *
 * Copy and paste this into browser console at localhost:3003
 * Or run via Playwright automation
 */

(async function runAlgorithmComparisonTest() {
  console.log('📊 Starting Algorithm Comparison Test');
  console.log('=====================================\n');

  // Import necessary functions (assumes they're available in window scope)
  const { generateOptimizedSchedule, validateSchedule, DEFAULT_RULES } = window;
  const { MOCK_OPERATORS, MOCK_TASKS } = window;
  const { calculateObjectives } = window;

  if (!generateOptimizedSchedule) {
    console.error('❌ generateOptimizedSchedule not found. Make sure you\'re on the app page.');
    return;
  }

  const testData = {
    operators: MOCK_OPERATORS,
    tasks: MOCK_TASKS,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    rules: DEFAULT_RULES,
  };

  console.log(`Test Configuration:
  - Operators: ${testData.operators.length}
  - Tasks: ${testData.tasks.length}
  - Days: ${testData.days.length}
  - Total Assignments Needed: ~${testData.operators.length * testData.days.length}
  `);

  // Test 1: Greedy Algorithm
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
  console.log(`  - Workload Balance: ${greedyObjectives.workloadBalance.toFixed(2)} tasks`);
  console.log(`  - Skill Match: ${greedyObjectives.skillMatchScore.toFixed(1)}%`);
  console.log(`  - Heavy Task Fairness: ${greedyObjectives.heavyTaskFairness.toFixed(3)}`);
  console.log(`  - Schedule Variety: ${greedyObjectives.scheduleVariety.toFixed(2)} tasks/operator`);
  console.log(`  - Total Score: ${greedyObjectives.totalScore.toFixed(1)}/100\n`);

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
  console.log(`✓ Improvement: ${tabuImprovement > 0 ? '+' : ''}${tabuImprovement.toFixed(2)}%`);
  console.log(`✓ Total Score: ${tabuObjectives.totalScore.toFixed(1)}/100\n`);

  // Test 3: Multi-Objective
  console.log('🎯 Test 3: Multi-Objective (Pareto Front)');
  console.log('----------------------------------------');

  const paretoStart = performance.now();
  const paretoResults = generateOptimizedSchedule({
    ...testData,
    rules: {
      ...DEFAULT_RULES,
      algorithm: 'multi-objective',
    },
  });
  const paretoEnd = performance.now();

  console.log(`✓ Execution Time: ${(paretoEnd - paretoStart).toFixed(2)}ms`);
  console.log(`✓ Solutions Found: ${paretoResults.length}\n`);

  // Summary
  console.log('📈 Summary');
  console.log('=====================================');
  console.log(`Greedy:        ${(greedyEnd - greedyStart).toFixed(0)}ms | Score: ${greedyObjectives.totalScore.toFixed(1)}/100`);
  console.log(`Tabu Search:   ${(tabuEnd - tabuStart).toFixed(0)}ms | Score: ${tabuObjectives.totalScore.toFixed(1)}/100 (${tabuImprovement > 0 ? '+' : ''}${tabuImprovement.toFixed(1)}%)`);
  console.log(`Multi-Obj:     ${(paretoEnd - paretoStart).toFixed(0)}ms | Solutions: ${paretoResults.length}`);
  console.log('\n✅ Test Complete!');

  return {
    greedy: { time: greedyEnd - greedyStart, objectives: greedyObjectives, warnings: greedyWarnings.length },
    tabu: { time: tabuEnd - tabuStart, objectives: tabuObjectives, warnings: tabuWarnings.length, improvement: tabuImprovement },
    pareto: { time: paretoEnd - paretoStart, results: paretoResults },
  };
})();
