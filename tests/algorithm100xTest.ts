/**
 * 100x Algorithm Test
 *
 * Tests the enhanced scheduling algorithm 100 times with varied configurations
 * to measure success rate and performance.
 */

import { generateEnhancedSchedule } from '../services/scheduling/enhancedScheduler';
import type { ScheduleRequestData } from '../services/schedulingService';
import type { Operator, TaskType, WeekDay } from '../types';

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Sample operators with varied skills and types
// IMPROVED: Ensures all skills are covered and availability is reasonable
function generateTestOperators(count: number): Operator[] {
  const regularSkills = ['Picking', 'Packing', 'Shipping', 'Returns'];
  const types: Array<'Regular' | 'Flex' | 'Coordinator'> = ['Regular', 'Flex', 'Coordinator'];

  const operators: Operator[] = [];

  // First 3 are coordinators (guaranteed)
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

    // Ensure good skill coverage by cycling through skills
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

    // Availability: at least 4 days available (randomly pick which days)
    const daysOff = Math.floor(Math.random() * 2); // 0 or 1 day off
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

// Sample tasks
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

// Generate task requirements with type constraints
function generateTaskRequirements(tasks: TaskType[], difficulty: 'easy' | 'medium' | 'hard') {
  const requirements = [];

  const counts = {
    easy: { regular: 2, flex: 1 },
    medium: { regular: 4, flex: 1 },
    hard: { regular: 3, flex: 2 },
  };

  const cfg = counts[difficulty];

  for (const task of tasks.slice(0, 4)) { // First 4 non-TC tasks
    requirements.push({
      taskId: task.id,
      enabled: true,
      defaultRequirements: [
        { type: 'Regular' as const, count: cfg.regular },
        { type: 'Flex' as const, count: cfg.flex },
      ],
    });
  }

  // TC tasks
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

interface TestResult {
  testNum: number;
  success: boolean;
  assignments: number;
  warnings: number;
  timeMs: number;
  difficulty: string;
  operatorCount: number;
}

async function runTest(testNum: number, difficulty: 'easy' | 'medium' | 'hard'): Promise<TestResult> {
  // Easy has more ops + lower requirements - should always succeed
  // Medium/Hard have tighter constraints but still solvable
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
    },
  };

  const startTime = Date.now();
  const result = generateEnhancedSchedule(data);
  const endTime = Date.now();

  // Check if successful (no critical warnings about understaffing)
  const criticalWarnings = result.warnings.filter(w =>
    w.type === 'understaffed' && w.message.includes('short')
  );

  return {
    testNum,
    success: criticalWarnings.length === 0,
    assignments: result.assignments.length,
    warnings: result.warnings.length,
    timeMs: endTime - startTime,
    difficulty,
    operatorCount,
  };
}

async function run100xTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ENHANCED SCHEDULING ALGORITHM - 100x TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const results: TestResult[] = [];
  const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

  // Suppress console logs during test
  const originalLog = console.log;

  for (let i = 0; i < 100; i++) {
    const difficulty = difficulties[i % 3];

    // Suppress algorithm logs
    console.log = () => {};

    try {
      const result = await runTest(i + 1, difficulty);
      results.push(result);
    } catch (error) {
      results.push({
        testNum: i + 1,
        success: false,
        assignments: 0,
        warnings: 999,
        timeMs: 0,
        difficulty,
        operatorCount: 0,
      });
    }

    // Restore for progress
    console.log = originalLog;

    if ((i + 1) % 10 === 0) {
      const successSoFar = results.filter(r => r.success).length;
      console.log(`Progress: ${i + 1}/100 tests complete (${successSoFar} successes)`);
    }
  }

  console.log = originalLog;

  // Calculate statistics
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  const byDifficulty = {
    easy: results.filter(r => r.difficulty === 'easy'),
    medium: results.filter(r => r.difficulty === 'medium'),
    hard: results.filter(r => r.difficulty === 'hard'),
  };

  const avgTime = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
  const maxTime = Math.max(...results.map(r => r.timeMs));
  const minTime = Math.min(...results.map(r => r.timeMs));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  OVERALL SUCCESS RATE: ${successful.length}% (${successful.length}/100)`);
  console.log('');
  console.log('  By Difficulty:');
  console.log(`    Easy:   ${byDifficulty.easy.filter(r => r.success).length}/${byDifficulty.easy.length} (${Math.round(byDifficulty.easy.filter(r => r.success).length / byDifficulty.easy.length * 100)}%)`);
  console.log(`    Medium: ${byDifficulty.medium.filter(r => r.success).length}/${byDifficulty.medium.length} (${Math.round(byDifficulty.medium.filter(r => r.success).length / byDifficulty.medium.length * 100)}%)`);
  console.log(`    Hard:   ${byDifficulty.hard.filter(r => r.success).length}/${byDifficulty.hard.length} (${Math.round(byDifficulty.hard.filter(r => r.success).length / byDifficulty.hard.length * 100)}%)`);
  console.log('');
  console.log('  Performance:');
  console.log(`    Avg Time: ${avgTime.toFixed(1)}ms`);
  console.log(`    Min Time: ${minTime}ms`);
  console.log(`    Max Time: ${maxTime}ms`);
  console.log('');

  if (failed.length > 0) {
    console.log('  Failed Tests:');
    failed.slice(0, 5).forEach(f => {
      console.log(`    Test #${f.testNum} (${f.difficulty}): ${f.warnings} warnings`);
    });
    if (failed.length > 5) {
      console.log(`    ... and ${failed.length - 5} more`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');

  return {
    successRate: successful.length,
    avgTime,
    results,
  };
}

// Run the test
run100xTest().then(({ successRate }) => {
  process.exit(successRate >= 95 ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
