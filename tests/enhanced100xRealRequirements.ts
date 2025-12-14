/**
 * Enhanced Algorithm 100x Test with Real Staffing Requirements
 *
 * Tests the Enhanced (greedy-tabu) algorithm 100 times with the exact
 * staffing requirements from the app configuration.
 *
 * Requirements from screenshot:
 * - Troubleshooter: 3 Regular
 * - Troubleshooter AD: 1 Regular
 * - Process: 1 Coordinator
 * - People: 1 Coordinator
 * - Off process: 1 Coordinator
 * - Exceptions/Station: 0
 * - Quality checker: 2 Regular
 * - MONO counter: 1 Regular
 * - Filler: 2 Regular
 * - LVB Sheet: 1 Regular
 * - Decanting: 0
 * - Platform: 1 Regular
 * - EST: 1 Regular
 * - Exceptions: 2 Regular
 *
 * Total per day: 17 Regular + 3 Coordinators = 20 assignments/day
 * Total for week: 20 × 5 = 100 assignments (minimum from requirements)
 */

import { generateSmartSchedule } from '../services/schedulingService';
import { refineScheduleWithTabuSearch } from '../services/scheduling/tabuSearchOptimizer';
import { DEFAULT_WEIGHTS } from '../services/scheduling/objectiveCalculators';
import type { ScheduleRequestData, ScheduleResult, SchedulingRules } from '../services/schedulingService';
import type { Operator, TaskType, WeekDay, TaskRequirement } from '../types';

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const RUNS = 100;

// ═══════════════════════════════════════════════════════════════════
// EXACT TASK DEFINITIONS FROM APP
// Separating TC tasks (Coordinator-only) from Regular/Flex tasks
// ═══════════════════════════════════════════════════════════════════

// TC tasks - ONLY for Coordinators (auto-scheduled separately)
const TC_TASKS = ['Process', 'People', 'Off process'];

function getAppTasks(): TaskType[] {
  return [
    // Regular/Flex operator tasks (these go through Staffing Requirements)
    { id: 't1', name: 'Troubleshooter', requiredSkill: 'Troubleshooter', color: '#3B82F6' },
    { id: 't2', name: 'Troubleshooter AD', requiredSkill: 'Troubleshooter AD', color: '#F59E0B' },
    { id: 't6', name: 'Exceptions/Station', requiredSkill: 'Exceptions/Station', color: '#EF4444' },
    { id: 't7', name: 'Quality checker', requiredSkill: 'Quality checker', color: '#1F2937' },
    { id: 't8', name: 'MONO counter', requiredSkill: 'MONO counter', color: '#F59E0B' },
    { id: 't9', name: 'Filler', requiredSkill: 'Filler', color: '#84CC16' },
    { id: 't10', name: 'LVB Sheet', requiredSkill: 'LVB Sheet', color: '#F59E0B' },
    { id: 't11', name: 'Decanting', requiredSkill: 'Decanting', color: '#22C55E' },
    { id: 't12', name: 'Platform', requiredSkill: 'Platform', color: '#EC4899' },
    { id: 't13', name: 'EST', requiredSkill: 'EST', color: '#8B5CF6' },
    { id: 't14', name: 'Exceptions', requiredSkill: 'Exceptions', color: '#EF4444' },
    // TC tasks - Only Coordinators can be assigned to these (auto-assigned)
    { id: 't3', name: 'Process', requiredSkill: 'Process', color: '#10B981' },
    { id: 't4', name: 'People', requiredSkill: 'People', color: '#10B981' },
    { id: 't5', name: 'Off process', requiredSkill: 'Off Process', color: '#9CA3AF' },
  ] as TaskType[];
}

// ═══════════════════════════════════════════════════════════════════
// EXACT REQUIREMENTS FROM SCREENSHOT - REGULAR/FLEX ONLY
// TC tasks (Process, People, Off process) are auto-scheduled separately
// ═══════════════════════════════════════════════════════════════════

function getAppRequirements(tasks: TaskType[]): TaskRequirement[] {
  // ONLY Regular/Flex task requirements - NO TC (Coordinator) tasks here!
  // Coordinators are auto-scheduled to Process/People/Off process separately
  return [
    { taskId: 't1', enabled: true, defaultRequirements: [{ type: 'Regular', count: 3 }] },      // Troubleshooter: 3 Regular
    { taskId: 't2', enabled: true, defaultRequirements: [{ type: 'Regular', count: 1 }] },      // Troubleshooter AD: 1 Regular
    { taskId: 't6', enabled: true, defaultRequirements: [{ type: 'Regular', count: 0 }] },      // Exceptions/Station: 0 (Flex task)
    { taskId: 't7', enabled: true, defaultRequirements: [{ type: 'Regular', count: 2 }] },      // Quality checker: 2 Regular
    { taskId: 't8', enabled: true, defaultRequirements: [{ type: 'Regular', count: 1 }] },      // MONO counter: 1 Regular
    { taskId: 't9', enabled: true, defaultRequirements: [{ type: 'Regular', count: 2 }] },      // Filler: 2 Regular
    { taskId: 't10', enabled: true, defaultRequirements: [{ type: 'Regular', count: 1 }] },     // LVB Sheet: 1 Regular
    { taskId: 't11', enabled: true, defaultRequirements: [{ type: 'Regular', count: 0 }] },     // Decanting: 0
    { taskId: 't12', enabled: true, defaultRequirements: [{ type: 'Regular', count: 1 }] },     // Platform: 1 Regular
    { taskId: 't13', enabled: true, defaultRequirements: [{ type: 'Regular', count: 1 }] },     // EST: 1 Regular
    { taskId: 't14', enabled: true, defaultRequirements: [{ type: 'Regular', count: 2 }] },     // Exceptions: 2 Regular
  ];
  // Note: TC tasks (Process, People, Off process) handled via autoAssignCoordinators rule
}

// ═══════════════════════════════════════════════════════════════════
// REALISTIC OPERATORS (similar to app data)
// IMPORTANT: TCs (Coordinators) are SEPARATE from Regular/Flex operators
// ═══════════════════════════════════════════════════════════════════

// TC-only skills - NEVER assigned to Regular/Flex
const TC_SKILLS = ['Process', 'People', 'Off Process'];

// Regular/Flex skills - NEVER assigned to Coordinators
const REGULAR_SKILLS = [
  'Troubleshooter', 'Troubleshooter AD', 'Quality checker', 'MONO counter',
  'Filler', 'LVB Sheet', 'Platform', 'EST', 'Exceptions', 'Exceptions/Station', 'Decanting'
];

function generateRealisticOperators(regularCount: number, coordinatorCount: number = 3): Operator[] {
  const operators: Operator[] = [];

  // ═══════════════════════════════════════════════════════════════════
  // COORDINATORS (TCs) - Only have TC skills (Process, People, Off Process)
  // These are auto-scheduled to TC tasks separately from Regular/Flex
  // ═══════════════════════════════════════════════════════════════════
  for (let i = 0; i < coordinatorCount; i++) {
    operators.push({
      id: `coord-${i}`,
      name: `TC ${i + 1}`,  // Team Coordinator
      skills: TC_SKILLS,    // ONLY TC skills - no regular task skills!
      type: 'Coordinator',
      status: 'Active',
      availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
      archived: false,
    } as Operator);
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGULAR/FLEX OPERATORS - Only have regular skills (NO TC skills!)
  // These fill Staffing Requirements (Troubleshooter, Quality checker, etc.)
  // ═══════════════════════════════════════════════════════════════════
  for (let i = 0; i < regularCount; i++) {
    // Mix of Regular and Flex (every 5th operator is Flex)
    const type = i % 5 === 0 ? 'Flex' : 'Regular';

    // Give each operator 3-5 skills from REGULAR_SKILLS only
    const numSkills = 3 + Math.floor(Math.random() * 3);
    const operatorSkills: string[] = [];

    // Primary skill based on index for even distribution
    const primaryIdx = i % REGULAR_SKILLS.length;
    operatorSkills.push(REGULAR_SKILLS[primaryIdx]);

    // Add more random skills
    while (operatorSkills.length < numSkills) {
      const skillIdx = Math.floor(Math.random() * REGULAR_SKILLS.length);
      const skill = REGULAR_SKILLS[skillIdx];
      if (!operatorSkills.includes(skill)) {
        operatorSkills.push(skill);
      }
    }

    // Ensure good Troubleshooter coverage (high demand: 3/day)
    if (i % 3 === 0 && !operatorSkills.includes('Troubleshooter')) {
      operatorSkills.push('Troubleshooter');
    }

    // Availability: most available all days, ~20% have 1 day off
    const availability: Record<WeekDay, boolean> = {
      Mon: true, Tue: true, Wed: true, Thu: true, Fri: true,
    };
    if (Math.random() < 0.2) {
      const offDay = DAYS[Math.floor(Math.random() * DAYS.length)];
      availability[offDay] = false;
    }

    operators.push({
      id: `op-${i}`,
      name: `Operator ${i + 1}`,
      skills: operatorSkills,  // ONLY regular skills - no TC skills!
      type,
      status: 'Active',
      availability,
      archived: false,
    } as Operator);
  }

  return operators;
}

// ═══════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════

interface TestResult {
  run: number;
  success: boolean;
  assignmentCount: number;
  warningCount: number;
  understaffedCount: number;
  executionTimeMs: number;
  seed: number;
  tabuImprovement: string;
}

function runSingleTest(runNum: number): TestResult {
  const tasks = getAppTasks();
  const requirements = getAppRequirements(tasks);
  // 21 Regular/Flex operators + 3 TCs (Coordinators) = 24 total like in app
  // IMPORTANT: TCs are separate and only handle Process/People/Off process
  const operators = generateRealisticOperators(21, 3);
  const seed = Math.floor(Math.random() * 1000000);

  const data: ScheduleRequestData = {
    operators,
    tasks,
    days: DAYS,
    taskRequirements: requirements,
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
      randomizationFactor: 20,
      heavyTasks: ['Troubleshooter', 'Quality checker', 'Troubleshooter AD', 'Platform'],
      softTasks: ['Filler', 'Exceptions', 'Decanting'],
      algorithm: 'greedy-tabu',
      schedulingSeed: seed,
    } as SchedulingRules,
  };

  const startTime = Date.now();

  // Run greedy first
  const greedyResult = generateSmartSchedule(data);

  // Then apply Tabu Search refinement (this is what "Enhanced" does)
  const tabuResult = refineScheduleWithTabuSearch(greedyResult, data, {
    maxIterations: 100,
    tabuListSize: 20,
    objectiveWeights: DEFAULT_WEIGHTS,
    timeoutMs: 5000,
  });

  const endTime = Date.now();

  const understaffedWarnings = tabuResult.warnings.filter(w => w.type === 'understaffed');

  // Calculate expected from requirements:
  // 3 + 1 + 2 + 1 + 2 + 1 + 1 + 1 + 2 = 14 Regular + 3 Coordinators = 17/day
  // × 5 days = 85 minimum (but some tasks have 0 requirement)
  // Success = no understaffed warnings (requirements met) and reasonable assignments
  const minRequiredAssignments = 70; // Approximate minimum from requirements
  const success = tabuResult.assignments.length >= minRequiredAssignments && understaffedWarnings.length === 0;

  return {
    run: runNum,
    success,
    assignmentCount: tabuResult.assignments.length,
    warningCount: tabuResult.warnings.length,
    understaffedCount: understaffedWarnings.length,
    executionTimeMs: endTime - startTime,
    seed,
    tabuImprovement: `${greedyResult.assignments.length} → ${tabuResult.assignments.length}`,
  };
}

async function run100xTest() {
  console.log('═'.repeat(70));
  console.log('  ENHANCED (GREEDY-TABU) 100x TEST');
  console.log('  Using Real Staffing Requirements');
  console.log('  ⚠️  TCs (Coordinators) SEPARATE from Regular/Flex operators');
  console.log('═'.repeat(70));
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  REGULAR/FLEX STAFFING REQUIREMENTS (from Settings)            │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  Troubleshooter:     3 Regular                                  │');
  console.log('│  Troubleshooter AD:  1 Regular                                  │');
  console.log('│  Quality checker:    2 Regular                                  │');
  console.log('│  MONO counter:       1 Regular                                  │');
  console.log('│  Filler:             2 Regular                                  │');
  console.log('│  LVB Sheet:          1 Regular                                  │');
  console.log('│  Platform:           1 Regular                                  │');
  console.log('│  EST:                1 Regular                                  │');
  console.log('│  Exceptions:         2 Regular                                  │');
  console.log('│  ─────────────────────────────────────────────────────────────  │');
  console.log('│  Total:              14 Regular/Flex per day                    │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  TC TASKS (Auto-scheduled separately)                          │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  Process:            1 Coordinator                              │');
  console.log('│  People:             1 Coordinator                              │');
  console.log('│  Off process:        1 Coordinator                              │');
  console.log('│  ─────────────────────────────────────────────────────────────  │');
  console.log('│  Total:              3 TCs per day (auto-assigned)             │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('Operators: 21 Regular/Flex + 3 TCs = 24 total');
  console.log('Expected Assignments: 14 Regular + 3 TC = 17/day × 5 = 85 from requirements');
  console.log('Target (all filled): 24 operators × 5 days = 120 assignments');
  console.log('');

  const results: TestResult[] = [];
  const originalLog = console.log;

  for (let i = 0; i < RUNS; i++) {
    console.log = () => {}; // Suppress during test

    try {
      const result = runSingleTest(i + 1);
      results.push(result);
    } catch (error) {
      results.push({
        run: i + 1,
        success: false,
        assignmentCount: 0,
        warningCount: 999,
        understaffedCount: 99,
        executionTimeMs: 0,
        seed: 0,
        tabuImprovement: 'ERROR',
      });
    }

    console.log = originalLog;

    if ((i + 1) % 10 === 0) {
      const successSoFar = results.filter(r => r.success).length;
      const avgAssign = results.reduce((s, r) => s + r.assignmentCount, 0) / results.length;
      console.log(`  Progress: ${i + 1}/${RUNS} | Success: ${successSoFar} | Avg Assignments: ${avgAssign.toFixed(0)}`);
    }
  }

  // Generate report
  console.log('');
  console.log('═'.repeat(70));
  console.log('  RESULTS');
  console.log('═'.repeat(70));

  const successful = results.filter(r => r.success);
  const avgAssignments = results.reduce((s, r) => s + r.assignmentCount, 0) / results.length;
  const avgTime = results.reduce((s, r) => s + r.executionTimeMs, 0) / results.length;
  const avgWarnings = results.reduce((s, r) => s + r.warningCount, 0) / results.length;
  const minAssign = Math.min(...results.map(r => r.assignmentCount));
  const maxAssign = Math.max(...results.map(r => r.assignmentCount));

  console.log('');
  console.log(`  SUCCESS RATE: ${successful.length}% (${successful.length}/${RUNS})`);
  console.log('');
  console.log('  Assignment Statistics:');
  console.log(`    Average: ${avgAssignments.toFixed(1)}`);
  console.log(`    Min: ${minAssign}`);
  console.log(`    Max: ${maxAssign}`);
  console.log(`    Range: ${maxAssign - minAssign}`);
  console.log('');
  console.log('  Performance:');
  console.log(`    Avg Time: ${avgTime.toFixed(0)}ms`);
  console.log(`    Avg Warnings: ${avgWarnings.toFixed(1)}`);
  console.log('');

  // Unique seeds verification
  const uniqueSeeds = new Set(results.map(r => r.seed)).size;
  const uniqueAssignments = new Set(results.map(r => r.assignmentCount)).size;
  console.log('  Variety Analysis:');
  console.log(`    Unique seeds: ${uniqueSeeds}`);
  console.log(`    Unique assignment counts: ${uniqueAssignments}`);
  console.log('');

  // Show some failures if any
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('  Failed Runs (first 5):');
    failures.slice(0, 5).forEach(f => {
      console.log(`    Run ${f.run}: ${f.assignmentCount} assignments, ${f.understaffedCount} understaffed`);
    });
  }

  console.log('');
  console.log('═'.repeat(70));

  return { successRate: successful.length, avgAssignments, results };
}

// Run the test
run100xTest().then(({ successRate }) => {
  process.exit(successRate >= 90 ? 0 : 1);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
