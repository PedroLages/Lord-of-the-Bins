/**
 * Max Matching (V4) Algorithm Stress Test
 *
 * Tests the Max Matching algorithm 200 times with the exact configuration
 * from Plan Week 51 to verify 100% fulfillment rate for hard skills.
 *
 * Configuration based on:
 * - Plan Week 51 requirements (3 Troubleshooter, 1 Troubleshooter AD, etc.)
 * - Max Matching (V4) algorithm
 * - All scheduling rules enabled as shown in Settings
 */

import { Operator, TaskType, WeekDay, TaskRequirement, OperatorTypeRequirement } from '../types';
import { SchedulingRules, generateOptimizedSchedule } from '../services/schedulingService';

// All 24 operators with their current skills (19 regular with all 10 skills, 2 flex, 3 coordinators)
const TEST_OPERATORS: Operator[] = [
  // Regular operators - ALL have ALL 10 skills
  { id: 'op1', name: 'Alesja', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op2', name: 'Beata', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op3', name: 'Bruno', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op4', name: 'Erica', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op5', name: 'Gulhatun', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op6', name: 'Ionel', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op7', name: 'Irma', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op20', name: 'Javier', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op8', name: 'José', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op9', name: 'Lukasz', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op12', name: 'Maha', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op13', name: 'Mihaela', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op14', name: 'Monikka', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op15', name: 'Nuno', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op16', name: 'Pedro', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op17', name: 'Susana', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op18', name: 'Sylwia', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op21', name: 'Yonay', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op19', name: 'Zeynep', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet', 'Decanting', 'Platform', 'EST', 'Exceptions', 'Troubleshooter AD'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },

  // Flex operators (2)
  { id: 'op22', name: 'Flex Op 1', type: 'Flex', status: 'Active', skills: ['Exceptions/Station'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op23', name: 'Flex Op 2', type: 'Flex', status: 'Active', skills: ['Exceptions/Station'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },

  // Coordinators (3)
  { id: 'op24', name: 'Floris', type: 'Coordinator', status: 'Active', skills: ['Process', 'People', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op10', name: 'Giedrius', type: 'Coordinator', status: 'Active', skills: ['Process', 'People', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op11', name: 'Natalia', type: 'Coordinator', status: 'Active', skills: ['People', 'Process', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
];

// Tasks from the system (14 tasks total)
const TEST_TASKS: TaskType[] = [
  { id: 't1', name: 'Troubleshooter', requiredSkill: 'Troubleshooter', color: 'blue', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't2', name: 'Quality Checker', requiredSkill: 'Quality Checker', color: 'green', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't3', name: 'MONO Counter', requiredSkill: 'MONO Counter', color: 'purple', textColor: 'white', isCoordinatorOnly: false },
  { id: 't4', name: 'Filler', requiredSkill: 'Filler', color: 'orange', textColor: 'white', isCoordinatorOnly: false },
  { id: 't5', name: 'LVB Sheet', requiredSkill: 'LVB Sheet', color: 'pink', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't6', name: 'Decanting', requiredSkill: 'Decanting', color: 'yellow', textColor: 'black', isCoordinatorOnly: false },
  { id: 't7', name: 'Platform', requiredSkill: 'Platform', color: 'teal', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't8', name: 'EST', requiredSkill: 'EST', color: 'indigo', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't9', name: 'Exceptions', requiredSkill: 'Exceptions', color: 'red', textColor: 'white', isCoordinatorOnly: false, isHeavy: true },
  { id: 't10', name: 'Troubleshooter AD', requiredSkill: 'Troubleshooter AD', color: 'cyan', textColor: 'black', isCoordinatorOnly: false, isHeavy: true },
  { id: 't11', name: 'Process', requiredSkill: 'Process', color: 'lightgreen', textColor: 'black', isCoordinatorOnly: true },
  { id: 't12', name: 'People', requiredSkill: 'People', color: 'lightgray', textColor: 'black', isCoordinatorOnly: true },
  { id: 't13', name: 'Off Process', requiredSkill: 'Off Process', color: 'lightgray', textColor: 'black', isCoordinatorOnly: true },
  { id: 't15', name: 'Exceptions/Station', requiredSkill: 'Exceptions/Station', color: 'amber', textColor: 'black', isCoordinatorOnly: false, isHeavy: true },
];

// Scheduling Rules from Settings (image 2)
const TEST_SCHEDULING_RULES: SchedulingRules = {
  algorithm: 'max-matching', // Max Matching (V4)
  strictSkillMatching: true,
  allowConsecutiveHeavyShifts: false,
  prioritizeFlexForExceptions: true,
  respectPreferredStations: true,
  maxConsecutiveDaysOnSameTask: 3,
  fairDistribution: true,
  balanceWorkload: true,
  prioritizeSkillVariety: true,
  autoAssignCoordinators: true,
  randomizationFactor: 10,
  useV2Algorithm: false,
};

// Task Requirements from Plan Week 51 (image 1)
const PLAN_WEEK_51_REQUIREMENTS: TaskRequirement[] = [
  {
    taskId: 't1', // Troubleshooter
    defaultRequirements: [{ type: 'Regular', count: 3 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't10', // Troubleshooter AD
    defaultRequirements: [{ type: 'Regular', count: 1 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't2', // Quality Checker
    defaultRequirements: [{ type: 'Regular', count: 2 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't3', // MONO Counter
    defaultRequirements: [{ type: 'Regular', count: 2 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't4', // Filler
    defaultRequirements: [{ type: 'Regular', count: 3 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't8', // EST
    defaultRequirements: [{ type: 'Regular', count: 1 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't7', // Platform
    defaultRequirements: [{ type: 'Regular', count: 1 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't5', // LVB Sheet
    defaultRequirements: [{ type: 'Regular', count: 1 }],
    dailyOverrides: {},
    enabled: true,
  },
  {
    taskId: 't9', // Exceptions
    defaultRequirements: [{ type: 'Regular', count: 2 }],
    dailyOverrides: {},
    enabled: true,
  },
];

// Days of the week
const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Hard skills are those that are less common or require specific expertise
const HARD_SKILLS = [
  'Troubleshooter AD',
  'EST',
  'Platform',
  'LVB Sheet',
];

interface TestResult {
  iteration: number;
  success: boolean;
  fulfillmentBySkill: Record<string, {
    required: number;
    assigned: number;
    fulfillmentRate: number;
  }>;
  totalAssignments: number;
  totalRequired: number;
  overallFulfillmentRate: number;
}

/**
 * Run a single iteration of the scheduling algorithm
 */
function runIteration(iteration: number): TestResult {
  // Empty assignments (fresh schedule)
  const currentAssignments: Record<string, Record<string, { taskId: string | null; locked: boolean; pinned?: boolean }>> = {};
  DAYS.forEach((_, idx) => {
    currentAssignments[idx] = {};
  });

  // Run the Max Matching algorithm
  const result = generateOptimizedSchedule({
    operators: TEST_OPERATORS,
    tasks: TEST_TASKS,
    days: DAYS,
    currentAssignments,
    rules: TEST_SCHEDULING_RULES,
    taskRequirements: PLAN_WEEK_51_REQUIREMENTS,
    excludedTasks: [],
  });

  // Analyze fulfillment for each skill
  const fulfillmentBySkill: Record<string, { required: number; assigned: number; fulfillmentRate: number }> = {};
  let totalRequired = 0;
  let totalAssigned = 0;

  PLAN_WEEK_51_REQUIREMENTS.forEach(req => {
    const task = TEST_TASKS.find(t => t.id === req.taskId);
    if (!task) return;

    const skill = task.requiredSkill;
    const requiredPerDay = req.defaultRequirements.reduce((sum, r) => sum + r.count, 0);
    const requiredTotal = requiredPerDay * DAYS.length; // 5 days

    // Count assignments for this task across all days
    // result.assignments is an array of { day, operatorId, taskId }
    const assignedTotal = result.assignments.filter(a => a.taskId === task.id).length;

    const fulfillmentRate = requiredTotal > 0 ? (assignedTotal / requiredTotal) * 100 : 100;

    fulfillmentBySkill[skill] = {
      required: requiredTotal,
      assigned: assignedTotal,
      fulfillmentRate,
    };

    totalRequired += requiredTotal;
    totalAssigned += assignedTotal;
  });

  const overallFulfillmentRate = totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 100;
  const success = overallFulfillmentRate === 100;

  return {
    iteration,
    success,
    fulfillmentBySkill,
    totalAssignments: totalAssigned,
    totalRequired,
    overallFulfillmentRate,
  };
}

/**
 * Main test function - runs 200 iterations
 */
function runStressTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Max Matching (V4) Algorithm - 200 Iteration Stress Test  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  • Algorithm: Max Matching (V4)`);
  console.log(`  • Operators: ${TEST_OPERATORS.length} (19 Regular + 2 Flex + 3 Coordinators)`);
  console.log(`  • Tasks: ${PLAN_WEEK_51_REQUIREMENTS.length} non-TC tasks`);
  console.log(`  • Days: ${DAYS.length} (Mon-Fri)`);
  console.log(`  • Hard Skills: ${HARD_SKILLS.join(', ')}`);
  console.log(`  • Scheduling Rules: All enabled (Strict Skill Matching, Fair Distribution, etc.)\n`);

  console.log('Task Requirements (Plan Week 51):');
  PLAN_WEEK_51_REQUIREMENTS.forEach(req => {
    const task = TEST_TASKS.find(t => t.id === req.taskId);
    const count = req.defaultRequirements.reduce((sum, r) => sum + r.count, 0);
    console.log(`  • ${task?.name}: ${count} per day (${count * 5} total)`);
  });
  console.log('');

  console.log('Running 200 iterations...\n');

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (let i = 1; i <= 200; i++) {
    if (i % 20 === 0) {
      process.stdout.write(`Progress: ${i}/200 (${Math.round((i / 200) * 100)}%)\r`);
    }
    const result = runIteration(i);
    results.push(result);
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST RESULTS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Overall statistics
  const successCount = results.filter(r => r.success).length;
  const successRate = (successCount / results.length) * 100;

  console.log(`Overall Success Rate: ${successRate.toFixed(2)}% (${successCount}/200 iterations)\n`);

  // Skill-by-skill analysis
  console.log('Fulfillment Rate by Skill (averaged across all iterations):');
  console.log('─'.repeat(70));

  const skillStats: Record<string, { totalRequired: number; totalAssigned: number; minRate: number; maxRate: number; avgRate: number }> = {};

  // Calculate statistics for each skill
  results.forEach(result => {
    Object.entries(result.fulfillmentBySkill).forEach(([skill, data]) => {
      if (!skillStats[skill]) {
        skillStats[skill] = {
          totalRequired: 0,
          totalAssigned: 0,
          minRate: 100,
          maxRate: 0,
          avgRate: 0,
        };
      }
      skillStats[skill].totalRequired += data.required;
      skillStats[skill].totalAssigned += data.assigned;
      skillStats[skill].minRate = Math.min(skillStats[skill].minRate, data.fulfillmentRate);
      skillStats[skill].maxRate = Math.max(skillStats[skill].maxRate, data.fulfillmentRate);
    });
  });

  // Calculate average rates
  Object.entries(skillStats).forEach(([skill, stats]) => {
    stats.avgRate = (stats.totalAssigned / stats.totalRequired) * 100;
  });

  // Display skill statistics (hard skills first)
  const hardSkillEntries = Object.entries(skillStats).filter(([skill]) => HARD_SKILLS.includes(skill));
  const otherSkillEntries = Object.entries(skillStats).filter(([skill]) => !HARD_SKILLS.includes(skill));

  console.log('\n🔴 HARD SKILLS:');
  hardSkillEntries.forEach(([skill, stats]) => {
    const avgRate = stats.avgRate.toFixed(2);
    const status = stats.avgRate === 100 ? '✅' : '❌';
    const requiredPerDay = stats.totalRequired / 200 / 5; // Total / iterations / days
    console.log(`  ${status} ${skill.padEnd(20)} | Req: ${requiredPerDay}/day | Avg: ${avgRate}% | Range: ${stats.minRate.toFixed(1)}%-${stats.maxRate.toFixed(1)}%`);
  });

  console.log('\n🟢 OTHER SKILLS:');
  otherSkillEntries.forEach(([skill, stats]) => {
    const avgRate = stats.avgRate.toFixed(2);
    const status = stats.avgRate === 100 ? '✅' : '❌';
    const requiredPerDay = stats.totalRequired / 200 / 5; // Total / iterations / days
    console.log(`  ${status} ${skill.padEnd(20)} | Req: ${requiredPerDay}/day | Avg: ${avgRate}% | Range: ${stats.minRate.toFixed(1)}%-${stats.maxRate.toFixed(1)}%`);
  });

  console.log('\n' + '─'.repeat(70));

  // Failed iterations (if any)
  const failedIterations = results.filter(r => !r.success);
  if (failedIterations.length > 0) {
    console.log(`\n⚠️  Failed Iterations: ${failedIterations.length}`);
    console.log('First 5 failures:');
    failedIterations.slice(0, 5).forEach(result => {
      console.log(`  Iteration #${result.iteration}: ${result.overallFulfillmentRate.toFixed(2)}% fulfillment`);
      Object.entries(result.fulfillmentBySkill).forEach(([skill, data]) => {
        if (data.fulfillmentRate < 100) {
          console.log(`    - ${skill}: ${data.assigned}/${data.required} (${data.fulfillmentRate.toFixed(1)}%)`);
        }
      });
    });
  } else {
    console.log('\n✅ All 200 iterations achieved 100% fulfillment!');
  }

  // Performance metrics
  console.log(`\n⏱️  Performance:`);
  console.log(`  • Total time: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`  • Average per iteration: ${(duration / 200).toFixed(2)}ms`);

  // Final verdict
  console.log('\n' + '═'.repeat(70));
  if (successRate === 100) {
    console.log('🎉 SUCCESS: Max Matching (V4) achieved 100% fulfillment in ALL 200 iterations!');
  } else {
    console.log(`⚠️  PARTIAL SUCCESS: ${successRate.toFixed(2)}% success rate (${successCount}/200 iterations)`);
  }
  console.log('═'.repeat(70) + '\n');
}

// Run the test
runStressTest();
