/**
 * Comprehensive Algorithm Comparison Test
 *
 * Tests all scheduling algorithms 10 times each:
 * - greedy: Standard fast algorithm
 * - enhanced: Constraint propagation + backtracking
 * - greedy-tabu: Greedy + Tabu Search refinement
 * - multi-objective: Pareto-optimal schedules
 *
 * Measures: success rate, assignment count, violations, execution time
 */

import { generateSmartSchedule } from '../services/schedulingService';
import { generateEnhancedSchedule } from '../services/scheduling/enhancedScheduler';
import { refineScheduleWithTabuSearch } from '../services/scheduling/tabuSearchOptimizer';
import { generateParetoSchedules } from '../services/scheduling/paretoFrontFinder';
import { DEFAULT_WEIGHTS } from '../services/scheduling/objectiveCalculators';
import type { ScheduleRequestData, ScheduleResult } from '../services/schedulingService';
import type { Operator, TaskType, WeekDay, TaskRequirement } from '../types';

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const RUNS_PER_ALGORITHM = 10;

// Test result structure
interface TestResult {
  run: number;
  success: boolean;
  assignmentCount: number;
  warningCount: number;
  executionTimeMs: number;
  understaffedTasks: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface AlgorithmResults {
  name: string;
  results: TestResult[];
  avgAssignments: number;
  avgTime: number;
  avgWarnings: number;
  successRate: number;
}

// Generate test operators with varied skills
function generateTestOperators(count: number): Operator[] {
  const regularSkills = ['Picking', 'Packing', 'Shipping', 'Returns'];
  const operators: Operator[] = [];

  // 3 coordinators
  for (let i = 0; i < 3; i++) {
    operators.push({
      id: `op-${i}`,
      name: `Coordinator ${i + 1}`,
      skills: ['Process', 'People', 'Off Process'],
      type: 'Coordinator',
      status: 'Active',
      availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
      archived: false,
    } as Operator);
  }

  // Regular and Flex operators with distributed skills
  for (let i = 3; i < count; i++) {
    const type = i % 2 === 0 ? 'Regular' : 'Flex';
    const primarySkillIdx = (i - 3) % regularSkills.length;
    const secondarySkillIdx = (primarySkillIdx + 1) % regularSkills.length;
    const operatorSkills = [
      regularSkills[primarySkillIdx],
      regularSkills[secondarySkillIdx],
    ];

    if (i % 3 === 0) {
      operatorSkills.push(regularSkills[(secondarySkillIdx + 1) % regularSkills.length]);
    }

    const daysOff = Math.floor(Math.random() * 2);
    const availability: Record<WeekDay, boolean> = {
      Mon: true, Tue: true, Wed: true, Thu: true, Fri: true,
    };
    if (daysOff > 0) {
      const offDay = DAYS[Math.floor(Math.random() * DAYS.length)];
      availability[offDay] = false;
    }

    operators.push({
      id: `op-${i}`,
      name: `Operator ${i + 1}`,
      skills: operatorSkills,
      type,
      status: 'Active',
      availability,
      archived: false,
    } as Operator);
  }

  return operators;
}

// Generate test tasks
function generateTestTasks(): TaskType[] {
  return [
    { id: 'task-1', name: 'Picking', requiredSkill: 'Picking', color: '#ff0000' },
    { id: 'task-2', name: 'Packing', requiredSkill: 'Packing', color: '#00ff00' },
    { id: 'task-3', name: 'Shipping', requiredSkill: 'Shipping', color: '#0000ff' },
    { id: 'task-4', name: 'Returns', requiredSkill: 'Returns', color: '#ffff00' },
    { id: 'task-5', name: 'Process', requiredSkill: 'Process', color: '#ff00ff' },
    { id: 'task-6', name: 'People', requiredSkill: 'People', color: '#00ffff' },
  ] as TaskType[];
}

// Generate task requirements
function generateTaskRequirements(tasks: TaskType[], difficulty: 'easy' | 'medium' | 'hard'): TaskRequirement[] {
  const requirements: TaskRequirement[] = [];
  const counts = {
    easy: { regular: 2, flex: 1 },
    medium: { regular: 4, flex: 1 },
    hard: { regular: 3, flex: 2 },
  };
  const cfg = counts[difficulty];

  for (const task of tasks.slice(0, 4)) {
    requirements.push({
      taskId: task.id,
      enabled: true,
      defaultRequirements: [
        { type: 'Regular' as const, count: cfg.regular },
        { type: 'Flex' as const, count: cfg.flex },
      ],
    });
  }

  for (const task of tasks.slice(4)) {
    requirements.push({
      taskId: task.id,
      enabled: true,
      defaultRequirements: [
        { type: 'Coordinator' as const, count: 1 },
      ],
    });
  }

  return requirements;
}

// Run a single test for an algorithm
function runAlgorithmTest(
  algorithmFn: (data: ScheduleRequestData) => ScheduleResult | any,
  testNum: number,
  difficulty: 'easy' | 'medium' | 'hard'
): TestResult {
  const operatorCount = difficulty === 'easy' ? 25 : difficulty === 'medium' ? 18 : 15;
  const operators = generateTestOperators(operatorCount);
  const tasks = generateTestTasks();
  const taskRequirements = generateTaskRequirements(tasks, difficulty);

  const data: ScheduleRequestData = {
    operators,
    tasks,
    days: DAYS,
    taskRequirements,
    excludedTasks: [],
    currentAssignments: {},
    rules: {
      strictSkillMatching: true,
      allowConsecutiveHeavyShifts: false,
      prioritizeFlexForExceptions: true,
      respectPreferredStations: true,
      maxConsecutiveDaysOnSameTask: 2,
      fairDistribution: true,
      balanceWorkload: true,
      autoAssignCoordinators: true,
      randomizationFactor: 10,
      heavyTasks: [],
      softTasks: [],
    },
  };

  const startTime = Date.now();
  let result: ScheduleResult;

  try {
    const output = algorithmFn(data);
    // Handle multi-objective which returns array of ScheduleWithObjectives
    if (Array.isArray(output)) {
      // Get the best schedule (first one if available)
      const bestSchedule = output[0];
      if (bestSchedule?.schedule) {
        result = bestSchedule.schedule;
      } else if (bestSchedule?.assignments) {
        result = bestSchedule as ScheduleResult;
      } else {
        result = { assignments: [], warnings: [] };
      }
    } else {
      result = output;
    }
  } catch (error) {
    return {
      run: testNum,
      success: false,
      assignmentCount: 0,
      warningCount: 999,
      executionTimeMs: Date.now() - startTime,
      understaffedTasks: 99,
      difficulty,
    };
  }

  const endTime = Date.now();
  const understaffedWarnings = result.warnings.filter(
    w => w.type === 'understaffed'
  );

  // Calculate expected minimum assignments (at least 3 operators per day for 5 days = 15 minimum)
  const minExpectedAssignments = 15;

  return {
    run: testNum,
    // Success = has enough assignments AND no critical warnings
    success: result.assignments.length >= minExpectedAssignments && understaffedWarnings.length === 0,
    assignmentCount: result.assignments.length,
    warningCount: result.warnings.length,
    executionTimeMs: endTime - startTime,
    understaffedTasks: understaffedWarnings.length,
    difficulty,
  };
}

// Run tests for a specific algorithm
function runAlgorithmTests(
  name: string,
  algorithmFn: (data: ScheduleRequestData) => ScheduleResult | any,
  runs: number
): AlgorithmResults {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Testing: ${name}`);
  console.log(`${'═'.repeat(60)}`);

  const results: TestResult[] = [];
  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

  // Suppress console logs during test
  const originalLog = console.log;

  for (let i = 0; i < runs; i++) {
    const difficulty = difficulties[i % 3];

    console.log = () => {}; // Suppress

    try {
      const result = runAlgorithmTest(algorithmFn, i + 1, difficulty);
      results.push(result);
    } catch (error) {
      results.push({
        run: i + 1,
        success: false,
        assignmentCount: 0,
        warningCount: 999,
        executionTimeMs: 0,
        understaffedTasks: 99,
        difficulty,
      });
    }

    console.log = originalLog; // Restore

    const lastResult = results[results.length - 1];
    const status = lastResult.success ? '✅' : '❌';
    console.log(`  Run ${i + 1}/${runs} (${difficulty}): ${status} ${lastResult.assignmentCount} assignments, ${lastResult.executionTimeMs}ms`);
  }

  const successful = results.filter(r => r.success);
  const avgAssignments = results.reduce((sum, r) => sum + r.assignmentCount, 0) / results.length;
  const avgTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length;
  const avgWarnings = results.reduce((sum, r) => sum + r.warningCount, 0) / results.length;

  return {
    name,
    results,
    avgAssignments,
    avgTime,
    avgWarnings,
    successRate: (successful.length / results.length) * 100,
  };
}

// Main test runner
async function runComparisonTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  COMPREHENSIVE ALGORITHM COMPARISON TEST');
  console.log('  Testing all algorithms ' + RUNS_PER_ALGORITHM + ' times each');
  console.log('═'.repeat(70));

  const allResults: AlgorithmResults[] = [];

  // 1. Test Standard Greedy
  allResults.push(runAlgorithmTests(
    'Greedy (Standard)',
    (data) => generateSmartSchedule(data),
    RUNS_PER_ALGORITHM
  ));

  // 2. Test Enhanced Algorithm
  allResults.push(runAlgorithmTests(
    'Enhanced (Constraint Propagation)',
    (data) => generateEnhancedSchedule(data),
    RUNS_PER_ALGORITHM
  ));

  // 3. Test Greedy + Tabu Search
  allResults.push(runAlgorithmTests(
    'Greedy + Tabu Search',
    (data) => {
      const initial = generateSmartSchedule(data);
      return refineScheduleWithTabuSearch(initial, data, {
        maxIterations: 100,
        tabuListSize: 20,
        objectiveWeights: DEFAULT_WEIGHTS,
        timeoutMs: 5000,
      });
    },
    RUNS_PER_ALGORITHM
  ));

  // 4. Test Multi-Objective (Pareto)
  allResults.push(runAlgorithmTests(
    'Multi-Objective (Pareto)',
    (data) => {
      const schedules = generateParetoSchedules(data, {
        numCandidates: 10,
        objectiveWeights: DEFAULT_WEIGHTS,
        timeoutMs: 5000,
      });
      return schedules; // Returns array, handled in test function
    },
    RUNS_PER_ALGORITHM
  ));

  // Generate report
  generateReport(allResults);

  return allResults;
}

// Generate comparison report
function generateReport(results: AlgorithmResults[]) {
  console.log('\n\n' + '═'.repeat(70));
  console.log('  ALGORITHM COMPARISON REPORT');
  console.log('═'.repeat(70));

  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ Algorithm                      │ Success │ Avg Assign │ Avg Time │');
  console.log('├' + '─'.repeat(68) + '┤');

  results.forEach(r => {
    const name = r.name.padEnd(30);
    const success = `${r.successRate.toFixed(0)}%`.padStart(7);
    const assign = r.avgAssignments.toFixed(0).padStart(10);
    const time = `${r.avgTime.toFixed(0)}ms`.padStart(8);
    console.log(`│ ${name} │ ${success} │ ${assign} │ ${time} │`);
  });

  console.log('└' + '─'.repeat(68) + '┘');

  // Detailed breakdown by difficulty
  console.log('\n\n  BREAKDOWN BY DIFFICULTY');
  console.log('  ' + '─'.repeat(50));

  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

  difficulties.forEach(diff => {
    console.log(`\n  ${diff.toUpperCase()}:`);
    results.forEach(r => {
      const diffResults = r.results.filter(res => res.difficulty === diff);
      const successCount = diffResults.filter(res => res.success).length;
      const avgTime = diffResults.reduce((sum, res) => sum + res.executionTimeMs, 0) / diffResults.length;
      console.log(`    ${r.name.padEnd(35)} ${successCount}/${diffResults.length} success, ${avgTime.toFixed(0)}ms avg`);
    });
  });

  // Find best algorithm
  console.log('\n\n  SUMMARY');
  console.log('  ' + '─'.repeat(50));

  const bySuccess = [...results].sort((a, b) => b.successRate - a.successRate);
  const bySpeed = [...results].sort((a, b) => a.avgTime - b.avgTime);

  console.log(`  🏆 Best Success Rate: ${bySuccess[0].name} (${bySuccess[0].successRate.toFixed(0)}%)`);
  console.log(`  ⚡ Fastest Algorithm: ${bySpeed[0].name} (${bySpeed[0].avgTime.toFixed(0)}ms)`);

  // Recommendations
  console.log('\n\n  RECOMMENDATIONS');
  console.log('  ' + '─'.repeat(50));

  if (bySuccess[0].name.includes('Enhanced')) {
    console.log('  ✅ Enhanced algorithm recommended for best reliability');
  } else if (bySuccess[0].name.includes('Greedy') && !bySuccess[0].name.includes('Tabu')) {
    console.log('  ✅ Standard Greedy is fast and reliable for simple scenarios');
  } else if (bySuccess[0].name.includes('Tabu')) {
    console.log('  ✅ Greedy + Tabu Search provides good optimization');
  } else if (bySuccess[0].name.includes('Multi')) {
    console.log('  ✅ Multi-Objective provides best trade-off analysis');
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

// Run tests
runComparisonTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
