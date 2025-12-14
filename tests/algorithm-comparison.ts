/**
 * Algorithm Comparison Test Script
 * Tests V1 (Standard) and V2 (Experimental) scheduling algorithms 100 times each
 *
 * Staffing Requirements for this test:
 * - Troubleshooter x3
 * - Troubleshooter AD x1
 * - Quality checker x2
 * - MONO counter x2
 * - Filler x2
 * - LVB sheet x1
 * - Decanting x0 (disabled)
 * - Platform x1
 * - EST x1
 * - Exceptions x2
 */

import { generateSmartSchedule, generateSmartScheduleV2, DEFAULT_RULES, SchedulingRules, ScheduleWarning } from '../services/schedulingService';
import { generateEnhancedSchedule } from '../services/scheduling/enhancedScheduler';
import { generateMaxMatchingSchedule } from '../services/scheduling/maxMatchingScheduler';
import { MOCK_OPERATORS, MOCK_TASKS, TaskRequirement, WeekDay, Operator, TaskType } from '../types';

// Test configuration
const TEST_ITERATIONS = 100;
const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Custom operators for testing - realistic multi-skill operators
// 3 operators have "Troubleshooter AD" skill added (they also have other skills)
// This tests the algorithm's ability to reserve scarce-skill operators for scarce tasks
const TEST_OPERATORS: Operator[] = MOCK_OPERATORS.map(op => {
  // Add "Troubleshooter AD" to 3 existing operators (Alesja, Bruno, Ionel)
  if (['op1', 'op3', 'op6'].includes(op.id)) {
    return {
      ...op,
      skills: [...op.skills, 'Troubleshooter AD'],
    };
  }
  return op;
});

// Task name to ID mapping (from MOCK_TASKS)
const TASK_ID_MAP: Record<string, string> = {
  'Troubleshooter': 't1',
  'Troubleshooter AD': 't10',
  'Quality checker': 't2',
  'MONO counter': 't3',
  'Filler': 't4',
  'LVB Sheet': 't5',
  'Decanting': 't6',
  'Platform': 't7',
  'EST': 't8',
  'Exceptions': 't9',
};

// Staffing requirements for this test
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

// Calculate total required per day (excluding TCs which are auto-scheduled)
const TOTAL_REQUIRED_PER_DAY = TEST_REQUIREMENTS.reduce((sum, req) =>
  sum + req.defaultRequirements.reduce((s, r) => s + r.count, 0), 0
);

interface TestResult {
  iteration: number;
  executionTimeMs: number;
  totalAssignments: number;
  assignmentsByDay: Record<WeekDay, number>;
  fulfillmentByTask: Record<string, { required: number; assigned: number; fulfillmentRate: number }>;
  warnings: ScheduleWarning[];
  constraintViolations: {
    skillMismatches: number;
    consecutiveHeavyShifts: number;
    maxConsecutiveDaysViolations: number;
  };
  operatorDistribution: {
    minAssignments: number;
    maxAssignments: number;
    avgAssignments: number;
    stdDev: number;
  };
  varietyScore: number; // How many different tasks operators get across the week
}

interface AggregateStats {
  algorithm: string;
  iterations: number;
  avgExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  avgTotalAssignments: number;
  avgFulfillmentRate: number; // Overall task fulfillment rate
  fulfillmentRateByTask: Record<string, number>;
  avgWarnings: number;
  totalWarnings: number;
  avgConstraintViolations: number;
  avgOperatorDistribution: {
    minAssignments: number;
    maxAssignments: number;
    avgAssignments: number;
    stdDev: number;
  };
  avgVarietyScore: number;
  successRate: number; // % of runs with 100% fulfillment
}

function analyzeResult(
  assignments: Array<{ day: WeekDay; operatorId: string; taskId: string }>,
  warnings: ScheduleWarning[],
  operators: Operator[],
  tasks: TaskType[],
  requirements: TaskRequirement[],
  iteration: number,
  executionTimeMs: number
): TestResult {
  // Assignments by day
  const assignmentsByDay: Record<WeekDay, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
  assignments.forEach(a => {
    assignmentsByDay[a.day]++;
  });

  // Task fulfillment
  const fulfillmentByTask: Record<string, { required: number; assigned: number; fulfillmentRate: number }> = {};

  for (const req of requirements) {
    const task = tasks.find(t => t.id === req.taskId);
    if (!task) continue;

    const requiredPerDay = req.defaultRequirements.reduce((sum, r) => sum + r.count, 0);
    const totalRequired = requiredPerDay * 5; // 5 days

    // Count assignments for this task
    const taskAssignments = assignments.filter(a => a.taskId === req.taskId).length;

    fulfillmentByTask[task.name] = {
      required: totalRequired,
      assigned: taskAssignments,
      fulfillmentRate: totalRequired > 0 ? (taskAssignments / totalRequired) * 100 : 100,
    };
  }

  // Constraint violations
  const constraintViolations = {
    skillMismatches: warnings.filter(w => w.type === 'skill_mismatch').length,
    consecutiveHeavyShifts: 0,
    maxConsecutiveDaysViolations: 0,
  };

  // Track consecutive heavy shifts and same-task violations
  const operatorHistory: Record<string, string[]> = {};
  DAYS.forEach(day => {
    assignments
      .filter(a => a.day === day)
      .forEach(a => {
        if (!operatorHistory[a.operatorId]) operatorHistory[a.operatorId] = [];
        operatorHistory[a.operatorId].push(a.taskId);
      });
  });

  const HEAVY_TASKS = ['t1', 't9']; // Troubleshooter, Exceptions
  for (const [opId, history] of Object.entries(operatorHistory)) {
    // Check consecutive heavy
    for (let i = 1; i < history.length; i++) {
      if (HEAVY_TASKS.includes(history[i]) && HEAVY_TASKS.includes(history[i - 1])) {
        constraintViolations.consecutiveHeavyShifts++;
      }
    }

    // Check max consecutive same task (default is 2)
    let consecutiveCount = 1;
    for (let i = 1; i < history.length; i++) {
      if (history[i] === history[i - 1] && history[i] !== '') {
        consecutiveCount++;
        if (consecutiveCount > 2) {
          constraintViolations.maxConsecutiveDaysViolations++;
        }
      } else {
        consecutiveCount = 1;
      }
    }
  }

  // Operator distribution
  const operatorAssignmentCounts: number[] = [];
  const regularOperators = operators.filter(op => op.type !== 'Coordinator');
  regularOperators.forEach(op => {
    const count = assignments.filter(a => a.operatorId === op.id).length;
    operatorAssignmentCounts.push(count);
  });

  const avgAssignments = operatorAssignmentCounts.reduce((a, b) => a + b, 0) / operatorAssignmentCounts.length;
  const stdDev = Math.sqrt(
    operatorAssignmentCounts.reduce((sum, count) => sum + Math.pow(count - avgAssignments, 2), 0) / operatorAssignmentCounts.length
  );

  // Variety score: how many different tasks each operator gets
  let totalVariety = 0;
  for (const op of regularOperators) {
    const opTasks = new Set(
      assignments.filter(a => a.operatorId === op.id).map(a => a.taskId)
    );
    totalVariety += opTasks.size;
  }
  const varietyScore = totalVariety / regularOperators.length;

  return {
    iteration,
    executionTimeMs,
    totalAssignments: assignments.length,
    assignmentsByDay,
    fulfillmentByTask,
    warnings,
    constraintViolations,
    operatorDistribution: {
      minAssignments: Math.min(...operatorAssignmentCounts),
      maxAssignments: Math.max(...operatorAssignmentCounts),
      avgAssignments,
      stdDev,
    },
    varietyScore,
  };
}

function aggregateResults(results: TestResult[], algorithmName: string): AggregateStats {
  const n = results.length;

  // Execution time stats
  const execTimes = results.map(r => r.executionTimeMs);
  const avgExecutionTimeMs = execTimes.reduce((a, b) => a + b, 0) / n;

  // Average fulfillment by task
  const fulfillmentRateByTask: Record<string, number> = {};
  const taskNames = Object.keys(results[0].fulfillmentByTask);
  for (const taskName of taskNames) {
    const rates = results.map(r => r.fulfillmentByTask[taskName]?.fulfillmentRate || 0);
    fulfillmentRateByTask[taskName] = rates.reduce((a, b) => a + b, 0) / n;
  }

  // Overall fulfillment rate
  const overallRates = results.map(r => {
    const rates = Object.values(r.fulfillmentByTask).map(f => f.fulfillmentRate);
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  });
  const avgFulfillmentRate = overallRates.reduce((a, b) => a + b, 0) / n;

  // Success rate (100% fulfillment)
  const successfulRuns = results.filter(r =>
    Object.values(r.fulfillmentByTask).every(f => f.fulfillmentRate >= 100)
  ).length;

  // Warnings
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  // Constraint violations
  const avgConstraintViolations = results.reduce((sum, r) =>
    sum + r.constraintViolations.skillMismatches +
    r.constraintViolations.consecutiveHeavyShifts +
    r.constraintViolations.maxConsecutiveDaysViolations, 0
  ) / n;

  // Operator distribution averages
  const avgOperatorDistribution = {
    minAssignments: results.reduce((sum, r) => sum + r.operatorDistribution.minAssignments, 0) / n,
    maxAssignments: results.reduce((sum, r) => sum + r.operatorDistribution.maxAssignments, 0) / n,
    avgAssignments: results.reduce((sum, r) => sum + r.operatorDistribution.avgAssignments, 0) / n,
    stdDev: results.reduce((sum, r) => sum + r.operatorDistribution.stdDev, 0) / n,
  };

  // Variety score
  const avgVarietyScore = results.reduce((sum, r) => sum + r.varietyScore, 0) / n;

  return {
    algorithm: algorithmName,
    iterations: n,
    avgExecutionTimeMs,
    minExecutionTimeMs: Math.min(...execTimes),
    maxExecutionTimeMs: Math.max(...execTimes),
    avgTotalAssignments: results.reduce((sum, r) => sum + r.totalAssignments, 0) / n,
    avgFulfillmentRate,
    fulfillmentRateByTask,
    avgWarnings: totalWarnings / n,
    totalWarnings,
    avgConstraintViolations,
    avgOperatorDistribution,
    avgVarietyScore,
    successRate: (successfulRuns / n) * 100,
  };
}

type SchedulerFunction = typeof generateSmartSchedule | typeof generateSmartScheduleV2 | typeof generateEnhancedSchedule | typeof generateMaxMatchingSchedule;

function runTest(
  algorithmFn: SchedulerFunction,
  algorithmName: string,
  iterations: number
): TestResult[] {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${algorithmName} - ${iterations} iterations`);
  console.log(`${'='.repeat(60)}`);

  const results: TestResult[] = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    const result = algorithmFn({
      operators: TEST_OPERATORS,
      tasks: MOCK_TASKS,
      days: DAYS,
      currentAssignments: {},
      rules: DEFAULT_RULES,
      taskRequirements: TEST_REQUIREMENTS,
    });

    const endTime = performance.now();
    const executionTimeMs = endTime - startTime;

    const analysis = analyzeResult(
      result.assignments,
      result.warnings,
      TEST_OPERATORS,
      MOCK_TASKS,
      TEST_REQUIREMENTS,
      i + 1,
      executionTimeMs
    );

    results.push(analysis);

    // Progress indicator every 10 iterations
    if ((i + 1) % 10 === 0) {
      console.log(`  Completed ${i + 1}/${iterations} iterations...`);
    }
  }

  return results;
}

function generateReport(v1Stats: AggregateStats, v2Stats: AggregateStats, v3Stats?: AggregateStats, v4Stats?: AggregateStats): string {
  const separator = '─'.repeat(120);
  const doubleSeparator = '═'.repeat(120);

  const col1 = 'V1 (Standard)';
  const col2 = 'V2 (Experimental)';
  const col3 = v3Stats ? 'V3 (Enhanced)' : '';
  const col4 = v4Stats ? 'V4 (MaxMatch)' : '';

  const formatRow = (label: string, v1: string, v2: string, v3?: string, v4?: string) => {
    const labelPad = label.padEnd(30);
    const v1Pad = v1.padEnd(18);
    const v2Pad = v2.padEnd(18);
    const v3Pad = v3 ? v3.padEnd(18) : '';
    return v4 ? `${labelPad}${v1Pad}${v2Pad}${v3Pad}${v4}` : (v3 ? `${labelPad}${v1Pad}${v2Pad}${v3}` : `${labelPad}${v1Pad}${v2}`);
  };

  let report = `
${doubleSeparator}
                         SCHEDULING ALGORITHM COMPARISON REPORT
${doubleSeparator}

Test Configuration:
  - Iterations per algorithm: ${TEST_ITERATIONS}
  - Days: Monday - Friday (5 days)
  - Operators: ${TEST_OPERATORS.length} total (${TEST_OPERATORS.filter(o => o.type === 'Regular').length} Regular, ${TEST_OPERATORS.filter(o => o.type === 'Flex').length} Flex, ${TEST_OPERATORS.filter(o => o.type === 'Coordinator').length} Coordinators)
  - Tasks: ${MOCK_TASKS.length} total
  - Note: 3 operators (Alesja, Bruno, Ionel) have "Troubleshooter AD" skill added (MULTI-SKILL)
  - This tests the algorithm's ability to reserve scarce-skill operators for scarce tasks

Staffing Requirements:
${TEST_REQUIREMENTS.map(req => {
  const task = MOCK_TASKS.find(t => t.id === req.taskId);
  const count = req.defaultRequirements.reduce((sum, r) => sum + r.count, 0);
  return `  - ${task?.name || req.taskId}: ${count} operator${count !== 1 ? 's' : ''}/day`;
}).join('\n')}

Total operators needed per day: ${TOTAL_REQUIRED_PER_DAY}

${separator}
                              PERFORMANCE METRICS
${separator}

${formatRow('', col1, col2, col3, col4)}
${formatRow('', '─'.repeat(15), '─'.repeat(15), v3Stats ? '─'.repeat(15) : '', v4Stats ? '─'.repeat(15) : '')}
${formatRow('Avg Execution Time:', `${v1Stats.avgExecutionTimeMs.toFixed(2)} ms`, `${v2Stats.avgExecutionTimeMs.toFixed(2)} ms`, v3Stats ? `${v3Stats.avgExecutionTimeMs.toFixed(2)} ms` : undefined, v4Stats ? `${v4Stats.avgExecutionTimeMs.toFixed(2)} ms` : undefined)}
${formatRow('Min Execution Time:', `${v1Stats.minExecutionTimeMs.toFixed(2)} ms`, `${v2Stats.minExecutionTimeMs.toFixed(2)} ms`, v3Stats ? `${v3Stats.minExecutionTimeMs.toFixed(2)} ms` : undefined, v4Stats ? `${v4Stats.minExecutionTimeMs.toFixed(2)} ms` : undefined)}
${formatRow('Max Execution Time:', `${v1Stats.maxExecutionTimeMs.toFixed(2)} ms`, `${v2Stats.maxExecutionTimeMs.toFixed(2)} ms`, v3Stats ? `${v3Stats.maxExecutionTimeMs.toFixed(2)} ms` : undefined, v4Stats ? `${v4Stats.maxExecutionTimeMs.toFixed(2)} ms` : undefined)}

${separator}
                              FULFILLMENT METRICS
${separator}

${formatRow('', col1, col2, col3, col4)}
${formatRow('', '─'.repeat(15), '─'.repeat(15), v3Stats ? '─'.repeat(15) : '', v4Stats ? '─'.repeat(15) : '')}
${formatRow('Success Rate (100% fill):', `${v1Stats.successRate.toFixed(1)}%`, `${v2Stats.successRate.toFixed(1)}%`, v3Stats ? `${v3Stats.successRate.toFixed(1)}%` : undefined, v4Stats ? `${v4Stats.successRate.toFixed(1)}%` : undefined)}
${formatRow('Avg Overall Fulfillment:', `${v1Stats.avgFulfillmentRate.toFixed(1)}%`, `${v2Stats.avgFulfillmentRate.toFixed(1)}%`, v3Stats ? `${v3Stats.avgFulfillmentRate.toFixed(1)}%` : undefined, v4Stats ? `${v4Stats.avgFulfillmentRate.toFixed(1)}%` : undefined)}
${formatRow('Avg Total Assignments:', `${v1Stats.avgTotalAssignments.toFixed(1)}`, `${v2Stats.avgTotalAssignments.toFixed(1)}`, v3Stats ? `${v3Stats.avgTotalAssignments.toFixed(1)}` : undefined, v4Stats ? `${v4Stats.avgTotalAssignments.toFixed(1)}` : undefined)}

Task-by-Task Fulfillment Rates:
`;

  const taskNames = Object.keys(v1Stats.fulfillmentRateByTask);
  for (const taskName of taskNames) {
    const v1Rate = v1Stats.fulfillmentRateByTask[taskName]?.toFixed(1) || '0.0';
    const v2Rate = v2Stats.fulfillmentRateByTask[taskName]?.toFixed(1) || '0.0';
    const v3Rate = v3Stats?.fulfillmentRateByTask[taskName]?.toFixed(1) || '0.0';
    const v4Rate = v4Stats?.fulfillmentRateByTask[taskName]?.toFixed(1) || '0.0';
    report += `${formatRow(`  ${taskName}:`, `${v1Rate}%`, `${v2Rate}%`, v3Stats ? `${v3Rate}%` : undefined, v4Stats ? `${v4Rate}%` : undefined)}\n`;
  }

  report += `
${separator}
                              QUALITY METRICS
${separator}

${formatRow('', col1, col2, col3, col4)}
${formatRow('', '─'.repeat(15), '─'.repeat(15), v3Stats ? '─'.repeat(15) : '', v4Stats ? '─'.repeat(15) : '')}
${formatRow('Avg Warnings:', `${v1Stats.avgWarnings.toFixed(2)}`, `${v2Stats.avgWarnings.toFixed(2)}`, v3Stats ? `${v3Stats.avgWarnings.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgWarnings.toFixed(2)}` : undefined)}
${formatRow('Avg Soft Violations:', `${v1Stats.avgConstraintViolations.toFixed(2)}`, `${v2Stats.avgConstraintViolations.toFixed(2)}`, v3Stats ? `${v3Stats.avgConstraintViolations.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgConstraintViolations.toFixed(2)}` : undefined)}
${formatRow('Avg Variety Score:', `${v1Stats.avgVarietyScore.toFixed(2)}`, `${v2Stats.avgVarietyScore.toFixed(2)}`, v3Stats ? `${v3Stats.avgVarietyScore.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgVarietyScore.toFixed(2)}` : undefined)}

${separator}
                           WORKLOAD DISTRIBUTION
${separator}

${formatRow('', col1, col2, col3, col4)}
${formatRow('', '─'.repeat(15), '─'.repeat(15), v3Stats ? '─'.repeat(15) : '', v4Stats ? '─'.repeat(15) : '')}
${formatRow('Min Assignments/Operator:', `${v1Stats.avgOperatorDistribution.minAssignments.toFixed(2)}`, `${v2Stats.avgOperatorDistribution.minAssignments.toFixed(2)}`, v3Stats ? `${v3Stats.avgOperatorDistribution.minAssignments.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgOperatorDistribution.minAssignments.toFixed(2)}` : undefined)}
${formatRow('Max Assignments/Operator:', `${v1Stats.avgOperatorDistribution.maxAssignments.toFixed(2)}`, `${v2Stats.avgOperatorDistribution.maxAssignments.toFixed(2)}`, v3Stats ? `${v3Stats.avgOperatorDistribution.maxAssignments.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgOperatorDistribution.maxAssignments.toFixed(2)}` : undefined)}
${formatRow('Avg Assignments/Operator:', `${v1Stats.avgOperatorDistribution.avgAssignments.toFixed(2)}`, `${v2Stats.avgOperatorDistribution.avgAssignments.toFixed(2)}`, v3Stats ? `${v3Stats.avgOperatorDistribution.avgAssignments.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgOperatorDistribution.avgAssignments.toFixed(2)}` : undefined)}
${formatRow('Std Deviation:', `${v1Stats.avgOperatorDistribution.stdDev.toFixed(2)}`, `${v2Stats.avgOperatorDistribution.stdDev.toFixed(2)}`, v3Stats ? `${v3Stats.avgOperatorDistribution.stdDev.toFixed(2)}` : undefined, v4Stats ? `${v4Stats.avgOperatorDistribution.stdDev.toFixed(2)}` : undefined)}

${separator}
                                 SUMMARY
${separator}

`;

  // Determine winners for each category (4-way comparison)
  const allStats = v4Stats ? [v1Stats, v2Stats, v3Stats!, v4Stats] : (v3Stats ? [v1Stats, v2Stats, v3Stats] : [v1Stats, v2Stats]);
  const names = v4Stats ? ['V1', 'V2', 'V3', 'V4'] : (v3Stats ? ['V1', 'V2', 'V3'] : ['V1', 'V2']);

  const findWinner = (getter: (s: AggregateStats) => number, lowerIsBetter: boolean): string => {
    const values = allStats.map(getter);
    const bestVal = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const winners = names.filter((_, i) => values[i] === bestVal);
    return winners.length === names.length ? 'TIED' : winners.join(' & ');
  };

  const metrics = [
    { name: 'Speed (Execution Time)', winner: findWinner(s => s.avgExecutionTimeMs, true), suffix: 'is FASTER' },
    { name: 'Success Rate (100% fill)', winner: findWinner(s => s.successRate, false), suffix: 'has HIGHEST success rate' },
    { name: 'Overall Fulfillment', winner: findWinner(s => s.avgFulfillmentRate, false), suffix: 'has BEST fulfillment' },
    { name: 'Soft Constraint Violations', winner: findWinner(s => s.avgConstraintViolations, true), suffix: 'has FEWEST violations' },
    { name: 'Workload Balance', winner: findWinner(s => s.avgOperatorDistribution.stdDev, true), suffix: 'is MORE BALANCED' },
    { name: 'Task Variety', winner: findWinner(s => s.avgVarietyScore, false), suffix: 'has MORE VARIETY' },
  ];

  for (const metric of metrics) {
    if (metric.winner === 'TIED') {
      report += `  - ${metric.name}: TIED\n`;
    } else {
      report += `  - ${metric.name}: ${metric.winner} ${metric.suffix}\n`;
    }
  }

  // Special highlight for Troubleshooter AD fulfillment (the key test)
  report += `
${separator}
                    KEY TEST: TROUBLESHOOTER AD FULFILLMENT
${separator}

This is the critical test - can the algorithm achieve 100% fulfillment for a scarce skill
when the only qualified operators also have other common skills?

`;

  const adTask = 'Troubleshooter AD';
  const v1AD = v1Stats.fulfillmentRateByTask[adTask]?.toFixed(1) || '0.0';
  const v2AD = v2Stats.fulfillmentRateByTask[adTask]?.toFixed(1) || '0.0';
  const v3AD = v3Stats?.fulfillmentRateByTask[adTask]?.toFixed(1) || 'N/A';
  const v4AD = v4Stats?.fulfillmentRateByTask[adTask]?.toFixed(1) || 'N/A';

  report += `  V1 (Standard):      ${v1AD}%\n`;
  report += `  V2 (Experimental):  ${v2AD}%\n`;
  if (v3Stats) {
    report += `  V3 (Enhanced):      ${v3AD}%  ${parseFloat(v3AD) >= 100 ? '<-- SUCCESS!' : ''}\n`;
  }
  if (v4Stats) {
    report += `  V4 (MaxMatching):   ${v4AD}%  ${parseFloat(v4AD) >= 100 ? '<-- SUCCESS!' : ''}\n`;
  }

  // Add 100% fulfillment check
  if (v4Stats && v4Stats.successRate === 100) {
    report += `\n  ** V4 ACHIEVED 100% SUCCESS RATE - ALL TASKS FULLY STAFFED! **\n`;
  }

  report += `
${doubleSeparator}
                               END OF REPORT
${doubleSeparator}
`;

  return report;
}

// Main execution
async function main() {
  console.log('Starting Algorithm Comparison Test...');
  console.log(`Test Iterations: ${TEST_ITERATIONS} per algorithm`);
  console.log(`Total Required Operators/Day: ${TOTAL_REQUIRED_PER_DAY}`);
  console.log(`Operators with Troubleshooter AD skill: ${TEST_OPERATORS.filter(op => op.skills.includes('Troubleshooter AD')).length} (multi-skill)`);

  // Suppress V3 console logs for cleaner output
  const originalLog = console.log;
  const suppressV3Logs = (fn: () => void) => {
    const savedLog = console.log;
    console.log = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('[Enhanced Scheduler]')) return;
      savedLog(...args);
    };
    fn();
    console.log = savedLog;
  };

  // Run V1 tests
  const v1Results = runTest(generateSmartSchedule, 'V1 (Standard)', TEST_ITERATIONS);
  const v1Stats = aggregateResults(v1Results, 'V1 (Standard)');

  // Run V2 tests
  const v2Results = runTest(generateSmartScheduleV2, 'V2 (Experimental)', TEST_ITERATIONS);
  const v2Stats = aggregateResults(v2Results, 'V2 (Experimental)');

  // Run V3 tests (with suppressed internal logs)
  console.log(`\n${'='.repeat(60)}`);
  console.log('Running V3 (Enhanced) - 100 iterations');
  console.log(`${'='.repeat(60)}`);

  const v3Results: TestResult[] = [];
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const startTime = performance.now();

    // Suppress V3 internal logs
    const savedLog = console.log;
    console.log = () => {};

    const result = generateEnhancedSchedule({
      operators: TEST_OPERATORS,
      tasks: MOCK_TASKS,
      days: DAYS,
      currentAssignments: {},
      rules: DEFAULT_RULES,
      taskRequirements: TEST_REQUIREMENTS,
    });

    console.log = savedLog;

    const endTime = performance.now();
    const executionTimeMs = endTime - startTime;

    const analysis = analyzeResult(
      result.assignments,
      result.warnings,
      TEST_OPERATORS,
      MOCK_TASKS,
      TEST_REQUIREMENTS,
      i + 1,
      executionTimeMs
    );

    v3Results.push(analysis);

    if ((i + 1) % 10 === 0) {
      console.log(`  Completed ${i + 1}/${TEST_ITERATIONS} iterations...`);
    }
  }

  const v3Stats = aggregateResults(v3Results, 'V3 (Enhanced)');

  // Run V4 tests (Maximum Matching - guarantees 100% when possible)
  console.log(`\n${'='.repeat(60)}`);
  console.log('Running V4 (MaxMatching) - 100 iterations');
  console.log(`${'='.repeat(60)}`);

  const v4Results: TestResult[] = [];
  for (let i = 0; i < TEST_ITERATIONS; i++) {
    const startTime = performance.now();

    // Suppress V4 internal logs
    const savedLog = console.log;
    console.log = () => {};

    const result = generateMaxMatchingSchedule({
      operators: TEST_OPERATORS,
      tasks: MOCK_TASKS,
      days: DAYS,
      currentAssignments: {},
      rules: DEFAULT_RULES,
      taskRequirements: TEST_REQUIREMENTS,
    });

    console.log = savedLog;

    const endTime = performance.now();
    const executionTimeMs = endTime - startTime;

    const analysis = analyzeResult(
      result.assignments,
      result.warnings,
      TEST_OPERATORS,
      MOCK_TASKS,
      TEST_REQUIREMENTS,
      i + 1,
      executionTimeMs
    );

    v4Results.push(analysis);

    if ((i + 1) % 10 === 0) {
      console.log(`  Completed ${i + 1}/${TEST_ITERATIONS} iterations...`);
    }
  }

  const v4Stats = aggregateResults(v4Results, 'V4 (MaxMatching)');

  // Generate report
  const report = generateReport(v1Stats, v2Stats, v3Stats, v4Stats);

  console.log(report);

  // Return stats for programmatic use
  return { v1Stats, v2Stats, v3Stats, v4Stats, report };
}

// Export for potential programmatic use
export { main, runTest, aggregateResults, generateReport };

// Run if executed directly
main();
