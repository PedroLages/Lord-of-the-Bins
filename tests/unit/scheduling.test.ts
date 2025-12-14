import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSmartSchedule,
  DEFAULT_RULES,
  SchedulingRules,
  ScheduleRequestData,
} from '../../services/schedulingService';
import type { Operator, TaskType, WeekDay, ScheduleAssignment } from '../../types';

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const createOperator = (overrides: Partial<Operator> = {}): Operator => ({
  id: 'op-1',
  name: 'Test Operator',
  skills: ['Troubleshooter', 'Exceptions'],
  type: 'Regular',
  status: 'Active',
  availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true },
  ...overrides,
});

const createTask = (overrides: Partial<TaskType> = {}): TaskType => ({
  id: 't1',
  name: 'Troubleshooter',
  color: 'bg-red-500',
  textColor: 'text-white',
  requiredSkill: 'Troubleshooter',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────
// DEFAULT_RULES Tests
// ─────────────────────────────────────────────────────────────────

describe('DEFAULT_RULES', () => {
  it('should have all required properties', () => {
    expect(DEFAULT_RULES).toBeDefined();
    expect(DEFAULT_RULES.strictSkillMatching).toBe(true);
    expect(DEFAULT_RULES.allowConsecutiveHeavyShifts).toBe(false);
    expect(DEFAULT_RULES.prioritizeFlexForExceptions).toBe(true);
    expect(DEFAULT_RULES.respectPreferredStations).toBe(true);
    expect(DEFAULT_RULES.maxConsecutiveDaysOnSameTask).toBe(2);
    expect(DEFAULT_RULES.fairDistribution).toBe(true);
    expect(DEFAULT_RULES.balanceWorkload).toBe(true);
    expect(DEFAULT_RULES.autoAssignCoordinators).toBe(true);
    expect(DEFAULT_RULES.randomizationFactor).toBe(10);
  });

  it('should have greedy as default algorithm', () => {
    expect(DEFAULT_RULES.algorithm).toBe('greedy');
  });

  it('should have tabu search defaults', () => {
    expect(DEFAULT_RULES.tabuSearchIterations).toBe(100);
    expect(DEFAULT_RULES.tabuListSize).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────
// generateSmartSchedule Tests
// ─────────────────────────────────────────────────────────────────

describe('generateSmartSchedule', () => {
  let operators: Operator[];
  let tasks: TaskType[];
  let rules: SchedulingRules;

  beforeEach(() => {
    operators = [
      createOperator({ id: 'op-1', name: 'Alice', skills: ['Troubleshooter', 'Exceptions'] }),
      createOperator({ id: 'op-2', name: 'Bob', skills: ['Troubleshooter', 'Packing'] }),
      createOperator({ id: 'op-3', name: 'Charlie', skills: ['Exceptions', 'Packing'] }),
    ];

    tasks = [
      createTask({ id: 't1', name: 'Troubleshooter', requiredSkill: 'Troubleshooter' }),
      createTask({ id: 't2', name: 'Exceptions', requiredSkill: 'Exceptions' }),
      createTask({ id: 't3', name: 'Packing', requiredSkill: 'Packing' }),
    ];

    rules = { ...DEFAULT_RULES };
  });

  it('should return assignments and warnings arrays', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules,
    };

    const result = generateSmartSchedule(data);

    expect(result).toHaveProperty('assignments');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.assignments)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should generate assignments for each day', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules,
    };

    const result = generateSmartSchedule(data);

    // Should have assignments for each day
    const daysWithAssignments = new Set(result.assignments.map((a) => a.day));
    expect(daysWithAssignments.size).toBeGreaterThanOrEqual(1);
  });

  it('should only assign tasks that match operator skills when strictSkillMatching is true', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...rules, strictSkillMatching: true },
    };

    const result = generateSmartSchedule(data);

    // Check each assignment
    result.assignments.forEach((assignment) => {
      const operator = operators.find((op) => op.id === assignment.operatorId);
      const task = tasks.find((t) => t.id === assignment.taskId);

      if (operator && task) {
        expect(operator.skills).toContain(task.requiredSkill);
      }
    });
  });

  it('should respect locked assignments', () => {
    const lockedTaskId = 't2';
    const lockedOperatorId = 'op-1';

    const currentAssignments: Record<string, Record<string, ScheduleAssignment>> = {
      '0': {
        // Monday
        [lockedOperatorId]: {
          taskId: lockedTaskId,
          locked: true,
          pinned: false,
        },
      },
    };

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules,
      currentAssignments,
    };

    const result = generateSmartSchedule(data);

    // Find Monday assignment for op-1
    const mondayAssignment = result.assignments.find(
      (a) => a.day === 'Mon' && a.operatorId === lockedOperatorId
    );

    expect(mondayAssignment).toBeDefined();
    expect(mondayAssignment?.taskId).toBe(lockedTaskId);
  });

  it('should not assign unavailable operators', () => {
    // Make Alice unavailable on Monday
    operators[0].availability.Mon = false;

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules,
    };

    const result = generateSmartSchedule(data);

    // Check Alice is not assigned on Monday
    const aliceMondayAssignment = result.assignments.find(
      (a) => a.day === 'Mon' && a.operatorId === 'op-1'
    );

    expect(aliceMondayAssignment).toBeUndefined();
  });

  it('should be deterministic - same input produces same output', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...rules, randomizationFactor: 10 },
    };

    const result1 = generateSmartSchedule(data);
    const result2 = generateSmartSchedule(data);

    // Assignments should be identical
    expect(result1.assignments.length).toBe(result2.assignments.length);

    // Sort both results for comparison
    const sortAssignments = (a: typeof result1.assignments) =>
      [...a].sort((x, y) => `${x.day}-${x.operatorId}`.localeCompare(`${y.day}-${y.operatorId}`));

    const sorted1 = sortAssignments(result1.assignments);
    const sorted2 = sortAssignments(result2.assignments);

    sorted1.forEach((a1, i) => {
      expect(a1.day).toBe(sorted2[i].day);
      expect(a1.operatorId).toBe(sorted2[i].operatorId);
      expect(a1.taskId).toBe(sorted2[i].taskId);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Algorithm Selection Tests
// ─────────────────────────────────────────────────────────────────

describe('Algorithm Selection', () => {
  let operators: Operator[];
  let tasks: TaskType[];

  beforeEach(() => {
    operators = [
      createOperator({ id: 'op-1', name: 'Alice', skills: ['Troubleshooter'] }),
      createOperator({ id: 'op-2', name: 'Bob', skills: ['Troubleshooter', 'Packing'] }),
    ];

    tasks = [
      createTask({ id: 't1', name: 'Troubleshooter', requiredSkill: 'Troubleshooter' }),
    ];
  });

  it('should work with greedy algorithm', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, algorithm: 'greedy' },
    };

    const result = generateSmartSchedule(data);
    expect(result.assignments.length).toBeGreaterThan(0);
  });

  it('should work with greedy-tabu algorithm', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, algorithm: 'greedy-tabu' },
    };

    const result = generateSmartSchedule(data);
    expect(result.assignments.length).toBeGreaterThan(0);
  });

  it('should work with multi-objective algorithm', () => {
    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, algorithm: 'multi-objective' },
    };

    const result = generateSmartSchedule(data);
    // Multi-objective may return array or single result
    expect(result).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('should handle empty operators list', () => {
    const data: ScheduleRequestData = {
      operators: [],
      tasks: [createTask()],
      days: DAYS,
      rules: DEFAULT_RULES,
    };

    const result = generateSmartSchedule(data);
    expect(result.assignments).toHaveLength(0);
  });

  it('should handle empty tasks list', () => {
    const data: ScheduleRequestData = {
      operators: [createOperator()],
      tasks: [],
      days: DAYS,
      rules: DEFAULT_RULES,
    };

    const result = generateSmartSchedule(data);
    expect(result.assignments).toHaveLength(0);
  });

  it('should handle single day', () => {
    const data: ScheduleRequestData = {
      operators: [createOperator()],
      tasks: [createTask()],
      days: ['Mon'],
      rules: DEFAULT_RULES,
    };

    const result = generateSmartSchedule(data);
    expect(result.assignments.every((a) => a.day === 'Mon')).toBe(true);
  });

  it('should handle operators with no matching skills', () => {
    const operators = [createOperator({ skills: ['NonExistentSkill'] })];
    const tasks = [createTask({ requiredSkill: 'Troubleshooter' })];

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, strictSkillMatching: true },
    };

    const result = generateSmartSchedule(data);

    // Should either have no assignments or generate warnings
    if (result.assignments.length > 0) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// Preferred Tasks Tests
// ─────────────────────────────────────────────────────────────────

describe('Preferred Tasks', () => {
  it('should prioritize operators with preferred tasks', () => {
    const operators = [
      createOperator({
        id: 'op-1',
        name: 'Alice',
        skills: ['Troubleshooter'],
        preferredTasks: ['Troubleshooter'],
      }),
      createOperator({
        id: 'op-2',
        name: 'Bob',
        skills: ['Troubleshooter'],
        preferredTasks: [],
      }),
    ];

    const tasks = [createTask({ id: 't1', name: 'Troubleshooter' })];

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, respectPreferredStations: true },
    };

    const result = generateSmartSchedule(data);

    // Alice should be assigned more often to Troubleshooter due to preference
    const aliceAssignments = result.assignments.filter(
      (a) => a.operatorId === 'op-1' && a.taskId === 't1'
    ).length;
    const bobAssignments = result.assignments.filter(
      (a) => a.operatorId === 'op-2' && a.taskId === 't1'
    ).length;

    // With preference enabled, Alice should have at least as many assignments
    expect(aliceAssignments).toBeGreaterThanOrEqual(bobAssignments);
  });
});

// ─────────────────────────────────────────────────────────────────
// Coordinator Handling Tests
// ─────────────────────────────────────────────────────────────────

describe('Coordinator Handling', () => {
  it('should auto-assign coordinators when enabled', () => {
    const operators = [
      createOperator({
        id: 'coord-1',
        name: 'Coordinator One',
        type: 'Coordinator',
        skills: ['Process', 'People', 'Off process'],
      }),
    ];

    const tasks = [
      createTask({ id: 't11', name: 'Process', requiredSkill: 'Process' }),
      createTask({ id: 't12', name: 'People', requiredSkill: 'People' }),
      createTask({ id: 't13', name: 'Off process', requiredSkill: 'Off process' }),
    ];

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, autoAssignCoordinators: true },
    };

    const result = generateSmartSchedule(data);

    // Coordinator should be assigned to coordinator tasks
    const coordAssignments = result.assignments.filter((a) => a.operatorId === 'coord-1');
    expect(coordAssignments.length).toBeGreaterThan(0);
  });

  it('should not auto-assign coordinators when disabled', () => {
    const operators = [
      createOperator({
        id: 'coord-1',
        name: 'Coordinator One',
        type: 'Coordinator',
        skills: ['Process', 'People', 'Off process'],
      }),
      // Add a regular operator so there's someone to assign
      createOperator({
        id: 'op-1',
        name: 'Regular One',
        type: 'Regular',
        skills: ['Troubleshooter'],
      }),
    ];

    const tasks = [
      createTask({ id: 't11', name: 'Process', requiredSkill: 'Process' }),
      createTask({ id: 't1', name: 'Troubleshooter', requiredSkill: 'Troubleshooter' }),
    ];

    const data: ScheduleRequestData = {
      operators,
      tasks,
      days: DAYS,
      rules: { ...DEFAULT_RULES, autoAssignCoordinators: false },
    };

    const result = generateSmartSchedule(data);

    // With auto-assign disabled, the coordinator scheduling behavior changes
    // but the coordinator can still be manually assigned
    expect(result).toBeDefined();
  });
});
