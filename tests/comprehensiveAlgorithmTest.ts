/**
 * Comprehensive 100x Algorithm Test with Rotating Rules
 *
 * Tests all 4 scheduling algorithms 100 times each with rule variations:
 * - greedy: Standard fast algorithm
 * - enhanced: Constraint propagation + backtracking (via greedy-tabu internally)
 * - greedy-tabu: Greedy + Tabu Search refinement
 * - multi-objective: Pareto-optimal schedules
 *
 * Rules change every 10 runs to test different configurations:
 * - Troubleshooter requirements (1x, 2x, 3x)
 * - Different task requirements
 * - Various scheduling rule combinations
 */

import { generateSmartSchedule, setSchedulingSeed } from '../services/schedulingService';
import { generateEnhancedSchedule } from '../services/scheduling/enhancedScheduler';
import { refineScheduleWithTabuSearch } from '../services/scheduling/tabuSearchOptimizer';
import { generateParetoSchedules } from '../services/scheduling/paretoFrontFinder';
import { DEFAULT_WEIGHTS } from '../services/scheduling/objectiveCalculators';
import type { ScheduleRequestData, ScheduleResult, SchedulingRules } from '../services/schedulingService';
import type { Operator, TaskType, WeekDay, TaskRequirement, OperatorTypeRequirement } from '../types';

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const RUNS_PER_ALGORITHM = 100;
const RULE_CHANGE_INTERVAL = 10; // Change rules every 10 runs

// ═══════════════════════════════════════════════════════════════════
// TEST RESULT TYPES
// ═══════════════════════════════════════════════════════════════════

interface TestResult {
  run: number;
  success: boolean;
  assignmentCount: number;
  warningCount: number;
  executionTimeMs: number;
  understaffedTasks: number;
  ruleConfig: string;
  seed: number;
}

interface AlgorithmResults {
  name: string;
  results: TestResult[];
  avgAssignments: number;
  avgTime: number;
  avgWarnings: number;
  successRate: number;
  byRuleConfig: Record<string, { success: number; total: number; avgTime: number }>;
}

// ═══════════════════════════════════════════════════════════════════
// RULE CONFIGURATIONS (Change every 10 runs)
// ═══════════════════════════════════════════════════════════════════

interface RuleConfig {
  name: string;
  description: string;
  operatorCount: number;
  requirements: (tasks: TaskType[]) => TaskRequirement[];
  rules: Partial<SchedulingRules>;
}

const RULE_CONFIGS: RuleConfig[] = [
  {
    name: 'Basic-1xTS',
    description: '1 Troubleshooter per day, easy requirements',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 1, regularPerTask: 1, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 20 },
  },
  {
    name: 'Medium-2xTS',
    description: '2 Troubleshooters per day, medium requirements',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 20 },
  },
  {
    name: 'Hard-3xTS',
    description: '3 Troubleshooters per day, hard requirements',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 3, regularPerTask: 2, flexPerTask: 2 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 20 },
  },
  {
    name: 'HighLoad-All',
    description: 'High load across all tasks',
    operatorCount: 30,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 3, flexPerTask: 2, anyPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 30 },
  },
  {
    name: 'LowRandom',
    description: 'Low randomization, strict ordering',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 5 },
  },
  {
    name: 'HighRandom',
    description: 'High randomization, more variety',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 50 },
  },
  {
    name: 'NoFairDist',
    description: 'Fair distribution disabled',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: false, balanceWorkload: true, randomizationFactor: 20 },
  },
  {
    name: 'NoWorkBal',
    description: 'Workload balance disabled',
    operatorCount: 24,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: false, randomizationFactor: 20 },
  },
  {
    name: 'Tight-20ops',
    description: 'Tight constraints with fewer operators',
    operatorCount: 20,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 2, regularPerTask: 2, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 20 },
  },
  {
    name: 'VeryTight-16ops',
    description: 'Very tight constraints with minimal operators',
    operatorCount: 16,
    requirements: (tasks) => createRequirements(tasks, { troubleshooterCount: 1, regularPerTask: 1, flexPerTask: 1 }),
    rules: { fairDistribution: true, balanceWorkload: true, randomizationFactor: 20 },
  },
];

// ═══════════════════════════════════════════════════════════════════
// TEST DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════

interface RequirementConfig {
  troubleshooterCount: number;
  regularPerTask: number;
  flexPerTask: number;
  anyPerTask?: number;
}

function createRequirements(tasks: TaskType[], config: RequirementConfig): TaskRequirement[] {
  const requirements: TaskRequirement[] = [];

  for (const task of tasks) {
    const reqs: OperatorTypeRequirement[] = [];

    // Handle Troubleshooter task specially
    if (task.name === 'Troubleshooter') {
      reqs.push({ type: 'Regular', count: config.troubleshooterCount });
    }
    // TC tasks (Process, People, Off Process)
    else if (['Process', 'People', 'Off Process'].includes(task.name)) {
      reqs.push({ type: 'Coordinator', count: 1 });
    }
    // Regular tasks
    else {
      if (config.regularPerTask > 0) reqs.push({ type: 'Regular', count: config.regularPerTask });
      if (config.flexPerTask > 0) reqs.push({ type: 'Flex', count: config.flexPerTask });
    }

    requirements.push({
      taskId: task.id,
      enabled: true,
      defaultRequirements: reqs,
    });
  }

  return requirements;
}

function generateTestOperators(count: number): Operator[] {
  const regularSkills = ['Picking', 'Packing', 'Shipping', 'Returns', 'Troubleshooter', 'Quality checker'];
  const operators: Operator[] = [];

  // 3 coordinators (always)
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

  // Rest are Regular/Flex with distributed skills
  for (let i = 3; i < count; i++) {
    const type = i % 2 === 0 ? 'Regular' : 'Flex';

    // Ensure skill coverage
    const primarySkillIdx = (i - 3) % regularSkills.length;
    const secondarySkillIdx = (primarySkillIdx + 1) % regularSkills.length;
    const operatorSkills = [
      regularSkills[primarySkillIdx],
      regularSkills[secondarySkillIdx],
    ];

    // Add more skills for some operators
    if (i % 3 === 0) {
      operatorSkills.push(regularSkills[(secondarySkillIdx + 1) % regularSkills.length]);
    }
    // Some operators have Troubleshooter skill
    if (i % 4 === 0) {
      operatorSkills.push('Troubleshooter');
    }

    // Varied availability (0-1 days off)
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

function generateTestTasks(): TaskType[] {
  return [
    { id: 't1', name: 'Picking', requiredSkill: 'Picking', color: '#ff0000' },
    { id: 't2', name: 'Packing', requiredSkill: 'Packing', color: '#00ff00' },
    { id: 't3', name: 'Shipping', requiredSkill: 'Shipping', color: '#0000ff' },
    { id: 't4', name: 'Returns', requiredSkill: 'Returns', color: '#ffff00' },
    { id: 't5', name: 'Troubleshooter', requiredSkill: 'Troubleshooter', color: '#ff00ff' },
    { id: 't6', name: 'Quality checker', requiredSkill: 'Quality checker', color: '#00ffff' },
    // TC tasks
    { id: 't11', name: 'Process', requiredSkill: 'Process', color: '#888888' },
    { id: 't12', name: 'People', requiredSkill: 'People', color: '#999999' },
    { id: 't13', name: 'Off Process', requiredSkill: 'Off Process', color: '#aaaaaa' },
  ] as TaskType[];
}

// ═══════════════════════════════════════════════════════════════════
// ALGORITHM TEST RUNNERS
// ═══════════════════════════════════════════════════════════════════

function runSingleTest(
  algorithmFn: (data: ScheduleRequestData) => ScheduleResult | any,
  ruleConfig: RuleConfig,
  testNum: number
): TestResult {
  const operators = generateTestOperators(ruleConfig.operatorCount);
  const tasks = generateTestTasks();
  const taskRequirements = ruleConfig.requirements(tasks);
  const seed = Math.floor(Math.random() * 1000000);

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
      autoAssignCoordinators: true,
      heavyTasks: ['Troubleshooter', 'Quality checker'],
      softTasks: ['Exceptions'],
      schedulingSeed: seed,
      ...ruleConfig.rules,
    } as SchedulingRules,
  };

  const startTime = Date.now();
  let result: ScheduleResult;

  try {
    const output = algorithmFn(data);
    // Handle multi-objective which returns array
    if (Array.isArray(output)) {
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
      ruleConfig: ruleConfig.name,
      seed,
    };
  }

  const endTime = Date.now();
  const understaffedWarnings = result.warnings.filter(w => w.type === 'understaffed');

  // Success = reasonable assignments with no critical understaffing
  const minExpectedAssignments = ruleConfig.operatorCount; // At least 1 per operator
  const success = result.assignments.length >= minExpectedAssignments && understaffedWarnings.length === 0;

  return {
    run: testNum,
    success,
    assignmentCount: result.assignments.length,
    warningCount: result.warnings.length,
    executionTimeMs: endTime - startTime,
    understaffedTasks: understaffedWarnings.length,
    ruleConfig: ruleConfig.name,
    seed,
  };
}

function runAlgorithmTests(
  name: string,
  algorithmFn: (data: ScheduleRequestData) => ScheduleResult | any,
  runs: number
): AlgorithmResults {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Testing: ${name}`);
  console.log(`${'═'.repeat(60)}`);

  const results: TestResult[] = [];
  const byRuleConfig: Record<string, { success: number; total: number; avgTime: number }> = {};

  // Initialize rule config tracking
  RULE_CONFIGS.forEach(cfg => {
    byRuleConfig[cfg.name] = { success: 0, total: 0, avgTime: 0 };
  });

  // Suppress console logs during test
  const originalLog = console.log;

  for (let i = 0; i < runs; i++) {
    const ruleConfigIdx = Math.floor(i / RULE_CHANGE_INTERVAL) % RULE_CONFIGS.length;
    const ruleConfig = RULE_CONFIGS[ruleConfigIdx];

    console.log = () => {}; // Suppress

    try {
      const result = runSingleTest(algorithmFn, ruleConfig, i + 1);
      results.push(result);

      // Track by rule config
      byRuleConfig[ruleConfig.name].total++;
      if (result.success) byRuleConfig[ruleConfig.name].success++;
      byRuleConfig[ruleConfig.name].avgTime += result.executionTimeMs;
    } catch (error) {
      results.push({
        run: i + 1,
        success: false,
        assignmentCount: 0,
        warningCount: 999,
        executionTimeMs: 0,
        understaffedTasks: 99,
        ruleConfig: ruleConfig.name,
        seed: 0,
      });
      byRuleConfig[ruleConfig.name].total++;
    }

    console.log = originalLog; // Restore

    const lastResult = results[results.length - 1];
    const status = lastResult.success ? '✅' : '❌';

    if ((i + 1) % 10 === 0) {
      const successSoFar = results.filter(r => r.success).length;
      console.log(`  Progress: ${i + 1}/${runs} (${successSoFar} successes) - Config: ${ruleConfig.name}`);
    }
  }

  // Calculate averages for rule configs
  Object.keys(byRuleConfig).forEach(key => {
    if (byRuleConfig[key].total > 0) {
      byRuleConfig[key].avgTime /= byRuleConfig[key].total;
    }
  });

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
    byRuleConfig,
  };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

async function runComprehensiveTests() {
  console.log('\n' + '═'.repeat(70));
  console.log('  COMPREHENSIVE ALGORITHM TEST - 100x with Rotating Rules');
  console.log('  Testing: greedy, enhanced, greedy-tabu, multi-objective');
  console.log('═'.repeat(70));

  console.log('\nRule Configurations:');
  RULE_CONFIGS.forEach((cfg, i) => {
    console.log(`  ${i + 1}. ${cfg.name}: ${cfg.description}`);
  });
  console.log('');

  const allResults: AlgorithmResults[] = [];

  // 1. Test Standard Greedy
  allResults.push(runAlgorithmTests(
    'Greedy (Standard)',
    (data) => generateSmartSchedule(data),
    RUNS_PER_ALGORITHM
  ));

  // 2. Test Enhanced Algorithm (direct)
  allResults.push(runAlgorithmTests(
    'Enhanced (Constraint)',
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
      return schedules;
    },
    RUNS_PER_ALGORITHM
  ));

  // Generate comprehensive report
  generateComprehensiveReport(allResults);

  return allResults;
}

// ═══════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════

function generateComprehensiveReport(results: AlgorithmResults[]) {
  console.log('\n\n' + '═'.repeat(70));
  console.log('  COMPREHENSIVE TEST REPORT');
  console.log('═'.repeat(70));

  // Overall summary
  console.log('\n┌' + '─'.repeat(68) + '┐');
  console.log('│ OVERALL SUMMARY                                                    │');
  console.log('├' + '─'.repeat(68) + '┤');
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

  // Breakdown by rule configuration
  console.log('\n\n' + '═'.repeat(70));
  console.log('  BREAKDOWN BY RULE CONFIGURATION');
  console.log('═'.repeat(70));

  RULE_CONFIGS.forEach(cfg => {
    console.log(`\n  📋 ${cfg.name}: ${cfg.description}`);
    console.log('  ' + '─'.repeat(50));

    results.forEach(r => {
      const stats = r.byRuleConfig[cfg.name];
      if (stats && stats.total > 0) {
        const rate = ((stats.success / stats.total) * 100).toFixed(0);
        console.log(`    ${r.name.padEnd(30)} ${stats.success}/${stats.total} (${rate}%) ${stats.avgTime.toFixed(0)}ms`);
      }
    });
  });

  // Variety analysis
  console.log('\n\n' + '═'.repeat(70));
  console.log('  VARIETY ANALYSIS (Are schedules different?)');
  console.log('═'.repeat(70));

  results.forEach(r => {
    // Check how many unique assignment counts we got
    const assignmentCounts = new Set(r.results.map(res => res.assignmentCount));
    const uniqueCounts = assignmentCounts.size;

    // Check seeds used
    const seeds = new Set(r.results.map(res => res.seed));
    const uniqueSeeds = seeds.size;

    console.log(`\n  ${r.name}:`);
    console.log(`    Unique assignment counts: ${uniqueCounts} (out of ${r.results.length} runs)`);
    console.log(`    Unique seeds used: ${uniqueSeeds}`);
    console.log(`    Assignment range: ${Math.min(...r.results.map(r => r.assignmentCount))} - ${Math.max(...r.results.map(r => r.assignmentCount))}`);
  });

  // Recommendations
  console.log('\n\n' + '═'.repeat(70));
  console.log('  RECOMMENDATIONS');
  console.log('═'.repeat(70));

  const bySuccess = [...results].sort((a, b) => b.successRate - a.successRate);
  const bySpeed = [...results].sort((a, b) => a.avgTime - b.avgTime);

  console.log(`\n  🏆 Best Success Rate: ${bySuccess[0].name} (${bySuccess[0].successRate.toFixed(0)}%)`);
  console.log(`  ⚡ Fastest Algorithm: ${bySpeed[0].name} (${bySpeed[0].avgTime.toFixed(0)}ms)`);

  // Find best for tight constraints
  const tightResults = results.map(r => ({
    name: r.name,
    tightSuccess: (r.byRuleConfig['Tight-20ops']?.success || 0) + (r.byRuleConfig['VeryTight-16ops']?.success || 0),
    tightTotal: (r.byRuleConfig['Tight-20ops']?.total || 0) + (r.byRuleConfig['VeryTight-16ops']?.total || 0),
  })).sort((a, b) => (b.tightSuccess / b.tightTotal) - (a.tightSuccess / a.tightTotal));

  if (tightResults[0].tightTotal > 0) {
    const rate = ((tightResults[0].tightSuccess / tightResults[0].tightTotal) * 100).toFixed(0);
    console.log(`  🎯 Best for Tight Constraints: ${tightResults[0].name} (${rate}%)`);
  }

  console.log('\n' + '═'.repeat(70) + '\n');
}

// ═══════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════

runComprehensiveTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
