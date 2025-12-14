import type { Operator, TaskType, WeekDay, ScheduleAssignment } from '../../types';
import type { ScheduleResult } from '../schedulingService';

/**
 * Multi-objective scores for evaluating schedule quality.
 * Each objective represents a different dimension of schedule quality.
 */
export interface ObjectiveScores {
  // Fairness: Lower = better (measures workload variance)
  fairness: number;

  // Workload Balance: Lower = better (max workload - min workload)
  workloadBalance: number;

  // Skill Match: Higher = better (% of perfect skill matches)
  skillMatchScore: number;

  // Heavy Task Distribution: Lower = better (std dev of heavy tasks)
  heavyTaskFairness: number;

  // Schedule Variety: Higher = better (avg unique tasks per operator)
  scheduleVariety: number;

  // Overall score (0-100): Higher = better (normalized weighted combination)
  totalScore: number;
}

/**
 * Weights for combining objectives into total score
 */
export interface ObjectiveWeights {
  fairness: number;
  workloadBalance: number;
  skillMatchScore: number;
  heavyTaskFairness: number;
  scheduleVariety: number;
}

export const DEFAULT_WEIGHTS: ObjectiveWeights = {
  fairness: 0.25,
  workloadBalance: 0.25,
  skillMatchScore: 0.20,
  heavyTaskFairness: 0.15,
  scheduleVariety: 0.15,
};

// Heavy tasks that should be rotated fairly
const HEAVY_TASKS = ['Troubleshooter', 'Exceptions'];

/**
 * Calculate all objective scores for a schedule
 */
export function calculateObjectives(
  schedule: ScheduleResult,
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[],
  weights: ObjectiveWeights = DEFAULT_WEIGHTS
): ObjectiveScores {
  const fairness = calculateFairnessScore(schedule, operators, days);
  const workloadBalance = calculateWorkloadBalance(schedule, operators, days);
  const skillMatchScore = calculateSkillMatchScore(schedule, operators, tasks);
  const heavyTaskFairness = calculateHeavyTaskFairness(schedule, operators, tasks, days);
  const scheduleVariety = calculateVarietyScore(schedule, operators, days);

  // Normalize and combine into total score (0-100)
  const totalScore = combineScores(
    { fairness, workloadBalance, skillMatchScore, heavyTaskFairness, scheduleVariety },
    weights
  );

  return {
    fairness,
    workloadBalance,
    skillMatchScore,
    heavyTaskFairness,
    scheduleVariety,
    totalScore,
  };
}

/**
 * Fairness Score: Standard deviation of operator workloads
 * Lower is better (0 = perfectly fair)
 */
function calculateFairnessScore(
  schedule: ScheduleResult,
  operators: Operator[],
  days: WeekDay[]
): number {
  // Count assignments per operator
  const workloads: Record<string, number> = {};
  operators.forEach(op => {
    workloads[op.id] = 0;
  });

  schedule.assignments.forEach(assignment => {
    workloads[assignment.operatorId] = (workloads[assignment.operatorId] || 0) + 1;
  });

  const counts = Object.values(workloads);
  if (counts.length === 0) return 0;

  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  return stdDev;
}

/**
 * Workload Balance: Difference between max and min operator workload
 * Lower is better (0 = perfect balance)
 */
function calculateWorkloadBalance(
  schedule: ScheduleResult,
  operators: Operator[],
  days: WeekDay[]
): number {
  // Count assignments per operator
  const workloads: Record<string, number> = {};
  operators.forEach(op => {
    workloads[op.id] = 0;
  });

  schedule.assignments.forEach(assignment => {
    workloads[assignment.operatorId] = (workloads[assignment.operatorId] || 0) + 1;
  });

  const counts = Object.values(workloads).filter(c => c > 0); // Only active operators
  if (counts.length === 0) return 0;

  const maxWorkload = Math.max(...counts);
  const minWorkload = Math.min(...counts);

  return maxWorkload - minWorkload;
}

/**
 * Skill Match Score: Percentage of assignments where operator has required skill
 * Higher is better (100 = all perfect matches)
 */
function calculateSkillMatchScore(
  schedule: ScheduleResult,
  operators: Operator[],
  tasks: TaskType[]
): number {
  if (schedule.assignments.length === 0) return 100;

  let perfectMatches = 0;

  schedule.assignments.forEach(assignment => {
    const operator = operators.find(op => op.id === assignment.operatorId);
    const task = tasks.find(t => t.id === assignment.taskId);

    if (operator && task && operator.skills.includes(task.requiredSkill)) {
      perfectMatches++;
    }
  });

  return (perfectMatches / schedule.assignments.length) * 100;
}

/**
 * Heavy Task Fairness: Standard deviation of heavy task assignments per operator
 * Lower is better (0 = perfectly fair distribution)
 */
function calculateHeavyTaskFairness(
  schedule: ScheduleResult,
  operators: Operator[],
  tasks: TaskType[],
  days: WeekDay[]
): number {
  // Count heavy task assignments per operator
  const heavyTaskCounts: Record<string, number> = {};
  operators.forEach(op => {
    heavyTaskCounts[op.id] = 0;
  });

  schedule.assignments.forEach(assignment => {
    const task = tasks.find(t => t.id === assignment.taskId);
    if (task && HEAVY_TASKS.includes(task.name)) {
      heavyTaskCounts[assignment.operatorId] = (heavyTaskCounts[assignment.operatorId] || 0) + 1;
    }
  });

  const counts = Object.values(heavyTaskCounts);
  if (counts.length === 0) return 0;

  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  return stdDev;
}

/**
 * Schedule Variety: Average number of unique tasks per operator
 * Higher is better (promotes task rotation)
 */
function calculateVarietyScore(
  schedule: ScheduleResult,
  operators: Operator[],
  days: WeekDay[]
): number {
  // Track unique tasks per operator
  const operatorTasks: Record<string, Set<string>> = {};
  operators.forEach(op => {
    operatorTasks[op.id] = new Set();
  });

  schedule.assignments.forEach(assignment => {
    if (!operatorTasks[assignment.operatorId]) {
      operatorTasks[assignment.operatorId] = new Set();
    }
    operatorTasks[assignment.operatorId].add(assignment.taskId);
  });

  // Calculate average unique tasks
  const uniqueCounts = Object.values(operatorTasks).map(tasks => tasks.size);
  const activeOperators = uniqueCounts.filter(count => count > 0);

  if (activeOperators.length === 0) return 0;

  const avgUniqueTasks = activeOperators.reduce((sum, count) => sum + count, 0) / activeOperators.length;

  return avgUniqueTasks;
}

/**
 * Combine individual objectives into overall score (0-100)
 * Normalizes each objective and applies weights
 */
function combineScores(
  objectives: Omit<ObjectiveScores, 'totalScore'>,
  weights: ObjectiveWeights
): number {
  // Normalize each objective to 0-100 scale

  // Fairness: std dev of 0 = 100 points, std dev of 2+ = 0 points
  const fairnessNorm = Math.max(0, 100 - (objectives.fairness / 2) * 100);

  // Workload Balance: diff of 0 = 100 points, diff of 5+ = 0 points
  const workloadNorm = Math.max(0, 100 - (objectives.workloadBalance / 5) * 100);

  // Skill Match: already 0-100
  const skillNorm = objectives.skillMatchScore;

  // Heavy Task Fairness: std dev of 0 = 100 points, std dev of 2+ = 0 points
  const heavyNorm = Math.max(0, 100 - (objectives.heavyTaskFairness / 2) * 100);

  // Variety: avg of 1 = 0 points, avg of 5+ = 100 points
  const varietyNorm = Math.min(100, ((objectives.scheduleVariety - 1) / 4) * 100);

  // Weighted combination
  const total =
    fairnessNorm * weights.fairness +
    workloadNorm * weights.workloadBalance +
    skillNorm * weights.skillMatchScore +
    heavyNorm * weights.heavyTaskFairness +
    varietyNorm * weights.scheduleVariety;

  return Math.round(total * 10) / 10; // Round to 1 decimal
}

/**
 * Compare two objective scores to determine if one strictly dominates the other
 * Returns true if objA is strictly better than objB in ALL objectives
 */
export function strictlyDominates(objA: ObjectiveScores, objB: ObjectiveScores): boolean {
  // For objectives where lower is better
  const fairnessImproved = objA.fairness <= objB.fairness;
  const workloadImproved = objA.workloadBalance <= objB.workloadBalance;
  const heavyImproved = objA.heavyTaskFairness <= objB.heavyTaskFairness;

  // For objectives where higher is better
  const skillImproved = objA.skillMatchScore >= objB.skillMatchScore;
  const varietyImproved = objA.scheduleVariety >= objB.scheduleVariety;

  // All must be better or equal
  const allBetterOrEqual =
    fairnessImproved && workloadImproved && heavyImproved && skillImproved && varietyImproved;

  // At least one must be strictly better
  const atLeastOneStrictlyBetter =
    objA.fairness < objB.fairness ||
    objA.workloadBalance < objB.workloadBalance ||
    objA.heavyTaskFairness < objB.heavyTaskFairness ||
    objA.skillMatchScore > objB.skillMatchScore ||
    objA.scheduleVariety > objB.scheduleVariety;

  return allBetterOrEqual && atLeastOneStrictlyBetter;
}

/**
 * Get a human-readable explanation of objective scores
 */
export function explainObjectives(objectives: ObjectiveScores): string[] {
  const explanations: string[] = [];

  // Fairness
  if (objectives.fairness < 0.5) {
    explanations.push('✅ Excellent workload fairness');
  } else if (objectives.fairness < 1.0) {
    explanations.push('✓ Good workload fairness');
  } else {
    explanations.push('⚠️ Workload could be more balanced');
  }

  // Workload Balance
  if (objectives.workloadBalance <= 1) {
    explanations.push('✅ Excellent workload distribution');
  } else if (objectives.workloadBalance <= 2) {
    explanations.push('✓ Good workload distribution');
  } else {
    explanations.push('⚠️ Some operators have significantly more tasks');
  }

  // Skill Match
  if (objectives.skillMatchScore >= 98) {
    explanations.push('✅ Perfect skill matching');
  } else if (objectives.skillMatchScore >= 90) {
    explanations.push('✓ Very good skill matching');
  } else {
    explanations.push('⚠️ Some skill mismatches present');
  }

  // Heavy Task Fairness
  if (objectives.heavyTaskFairness < 0.5) {
    explanations.push('✅ Fair distribution of heavy tasks');
  } else if (objectives.heavyTaskFairness < 1.0) {
    explanations.push('✓ Reasonable heavy task distribution');
  } else {
    explanations.push('⚠️ Heavy tasks could be distributed more evenly');
  }

  // Variety
  if (objectives.scheduleVariety >= 3) {
    explanations.push('✅ Excellent task variety');
  } else if (objectives.scheduleVariety >= 2) {
    explanations.push('✓ Good task variety');
  } else {
    explanations.push('⚠️ Limited task variety (operators on same tasks)');
  }

  return explanations;
}
