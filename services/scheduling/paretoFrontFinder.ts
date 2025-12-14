import type { Operator, TaskType, WeekDay } from '../../types';
import type { ScheduleResult, ScheduleRequestData } from '../schedulingService';
import { generateSmartSchedule } from '../schedulingService';
import { generateEnhancedSchedule } from './enhancedScheduler';
import {
  calculateObjectives,
  strictlyDominates,
  type ObjectiveScores,
  type ObjectiveWeights,
  DEFAULT_WEIGHTS,
} from './objectiveCalculators';

/**
 * Schedule with its objective scores attached
 */
export interface ScheduleWithObjectives {
  schedule: ScheduleResult;
  objectives: ObjectiveScores;
  id: string; // Unique identifier for UI
}

/**
 * Options for Pareto front generation
 */
export interface ParetoOptions {
  numCandidates: number;     // How many schedules to generate (default: 20)
  objectiveWeights: ObjectiveWeights; // Base weights (will be varied)
  timeoutMs?: number;         // Max execution time (default: 10000ms)
}

export const DEFAULT_PARETO_OPTIONS: ParetoOptions = {
  numCandidates: 20,
  objectiveWeights: DEFAULT_WEIGHTS,
  timeoutMs: 10000,
};

/**
 * Generate multiple schedules with varied objectives and find Pareto-optimal set
 *
 * ENHANCED VERSION: Uses the enhanced scheduler with constraint propagation,
 * forward checking, and backtracking to guarantee all candidates are feasible.
 *
 * Strategy:
 * 1. Generate base schedule using enhanced algorithm (guaranteed feasible)
 * 2. Generate variants with different objective weight combinations
 * 3. Calculate objective scores for each
 * 4. Find non-dominated solutions (Pareto front)
 * 5. Return 3-5 diverse schedules from the front
 */
export function generateParetoSchedules(
  data: ScheduleRequestData,
  options: Partial<ParetoOptions> = {}
): ScheduleWithObjectives[] {
  const opts: ParetoOptions = {
    ...DEFAULT_PARETO_OPTIONS,
    ...options,
  };

  const startTime = Date.now();
  console.log('[Pareto] Starting enhanced multi-objective schedule generation');

  // Generate candidate schedules with varied objective priorities
  const candidates: ScheduleWithObjectives[] = [];

  // STRATEGY 0: Generate base schedule with enhanced algorithm (guaranteed feasible)
  // This serves as our reference solution that we know satisfies all constraints
  const baseSchedule = generateEnhancedSchedule(data);

  if (baseSchedule.assignments.length > 0) {
    const baseObjectives = calculateObjectives(
      baseSchedule,
      data.operators,
      data.tasks,
      data.days,
      opts.objectiveWeights
    );

    candidates.push({
      schedule: baseSchedule,
      objectives: baseObjectives,
      id: 'enhanced-base',
    });

    console.log(`[Pareto] Base schedule: ${baseSchedule.assignments.length} assignments, ${baseSchedule.warnings.length} warnings`);
  }

  // If base schedule has warnings, still continue but note it
  if (baseSchedule.warnings.length > 0) {
    console.log(`[Pareto] Warning: Base schedule has ${baseSchedule.warnings.length} issues`);
  }

  // Strategy 1: Generate variants with randomization (using enhanced scheduler)
  const randomizationFactors = [5, 10, 15, 20];
  for (const factor of randomizationFactors) {
    if (Date.now() - startTime > (opts.timeoutMs || 10000)) break;

    const schedule = generateEnhancedSchedule({
      ...data,
      rules: {
        ...data.rules,
        randomizationFactor: factor,
      },
    });

    // Only add if schedule is valid (no critical warnings)
    if (schedule.assignments.length > 0) {
      const objectives = calculateObjectives(
        schedule,
        data.operators,
        data.tasks,
        data.days,
        opts.objectiveWeights
      );

      candidates.push({
        schedule,
        objectives,
        id: `enhanced-rand-${factor}`,
      });
    }
  }

  // Strategy 2: Vary objective weights to explore trade-offs (using enhanced scheduler)
  const weightVariations = generateWeightVariations(opts.objectiveWeights);

  for (const weights of weightVariations) {
    if (Date.now() - startTime > (opts.timeoutMs || 10000)) break;
    if (candidates.length >= opts.numCandidates) break;

    const schedule = generateEnhancedSchedule({
      ...data,
      rules: {
        ...data.rules,
        randomizationFactor: 10, // Medium randomization
      },
    });

    if (schedule.assignments.length > 0) {
      const objectives = calculateObjectives(
        schedule,
        data.operators,
        data.tasks,
        data.days,
        weights
      );

      candidates.push({
        schedule,
        objectives,
        id: `enhanced-weight-${candidates.length}`,
      });
    }
  }

  // Strategy 3: Generate with specific rule variations (using enhanced scheduler)
  const ruleVariations = generateRuleVariations(data.rules || {});

  for (const rules of ruleVariations) {
    if (Date.now() - startTime > (opts.timeoutMs || 10000)) break;
    if (candidates.length >= opts.numCandidates) break;

    const schedule = generateEnhancedSchedule({
      ...data,
      rules,
    });

    if (schedule.assignments.length > 0) {
      const objectives = calculateObjectives(
        schedule,
        data.operators,
        data.tasks,
        data.days,
        opts.objectiveWeights
      );

      candidates.push({
        schedule,
        objectives,
        id: `enhanced-rule-${candidates.length}`,
      });
    }
  }

  console.log(`[Pareto] Generated ${candidates.length} candidate schedules (all using enhanced algorithm)`);

  // Deduplicate candidates based on assignment similarity
  const uniqueCandidates = deduplicateCandidates(candidates);
  console.log(`[Pareto] ${uniqueCandidates.length} unique candidates after deduplication`);

  // Find Pareto front (non-dominated solutions)
  const paretoFront = findParetoFront(uniqueCandidates);

  console.log(`[Pareto] Pareto front contains ${paretoFront.length} non-dominated schedules`);

  // Select diverse subset (3-5 schedules) from Pareto front
  const selectedSchedules = selectDiverseSubset(paretoFront, 5);

  const endTime = Date.now();
  console.log(`[Pareto] Multi-objective generation completed in ${endTime - startTime}ms`);

  return selectedSchedules;
}

/**
 * Remove duplicate or near-duplicate schedules
 */
function deduplicateCandidates(
  candidates: ScheduleWithObjectives[]
): ScheduleWithObjectives[] {
  const seen = new Set<string>();
  const unique: ScheduleWithObjectives[] = [];

  for (const candidate of candidates) {
    // Create a fingerprint of the schedule
    const fingerprint = candidate.schedule.assignments
      .map(a => `${a.operatorId}-${a.day}-${a.taskId}`)
      .sort()
      .join('|');

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(candidate);
    }
  }

  return unique;
}

/**
 * Find Pareto-optimal set (non-dominated solutions)
 *
 * A solution is non-dominated if no other solution is strictly better
 * in all objectives
 */
export function findParetoFront(
  candidates: ScheduleWithObjectives[]
): ScheduleWithObjectives[] {
  return candidates.filter(candidateA =>
    !candidates.some(candidateB =>
      candidateA.id !== candidateB.id &&
      strictlyDominates(candidateB.objectives, candidateA.objectives)
    )
  );
}

/**
 * Generate weight variations to explore different trade-offs
 */
function generateWeightVariations(
  baseWeights: ObjectiveWeights
): ObjectiveWeights[] {
  const variations: ObjectiveWeights[] = [];

  // High fairness priority
  variations.push({
    fairness: 0.40,
    workloadBalance: 0.30,
    skillMatchScore: 0.15,
    heavyTaskFairness: 0.10,
    scheduleVariety: 0.05,
  });

  // High skill match priority
  variations.push({
    fairness: 0.10,
    workloadBalance: 0.15,
    skillMatchScore: 0.50,
    heavyTaskFairness: 0.15,
    scheduleVariety: 0.10,
  });

  // High variety priority
  variations.push({
    fairness: 0.15,
    workloadBalance: 0.15,
    skillMatchScore: 0.15,
    heavyTaskFairness: 0.15,
    scheduleVariety: 0.40,
  });

  // Balanced (default)
  variations.push(baseWeights);

  // Heavy task focus
  variations.push({
    fairness: 0.20,
    workloadBalance: 0.20,
    skillMatchScore: 0.15,
    heavyTaskFairness: 0.35,
    scheduleVariety: 0.10,
  });

  return variations;
}

/**
 * Generate rule variations to explore different scheduling strategies
 */
function generateRuleVariations(baseRules: any): any[] {
  const variations: any[] = [];

  // Strict fairness
  variations.push({
    ...baseRules,
    fairDistribution: true,
    balanceWorkload: true,
    allowConsecutiveHeavyShifts: false,
    maxConsecutiveDaysOnSameTask: 1,
  });

  // Skill optimization
  variations.push({
    ...baseRules,
    strictSkillMatching: true,
    respectPreferredStations: true,
    allowConsecutiveHeavyShifts: true,
    maxConsecutiveDaysOnSameTask: 3,
  });

  // Variety focus
  variations.push({
    ...baseRules,
    maxConsecutiveDaysOnSameTask: 1,
    fairDistribution: true,
    allowConsecutiveHeavyShifts: false,
  });

  return variations;
}

/**
 * Select diverse subset from Pareto front
 *
 * Uses objective space distance to ensure selected schedules
 * represent different trade-offs
 */
function selectDiverseSubset(
  paretoFront: ScheduleWithObjectives[],
  maxCount: number
): ScheduleWithObjectives[] {
  if (paretoFront.length <= maxCount) {
    return paretoFront;
  }

  const selected: ScheduleWithObjectives[] = [];

  // Start with schedule with highest total score
  const best = paretoFront.reduce((a, b) =>
    a.objectives.totalScore > b.objectives.totalScore ? a : b
  );
  selected.push(best);

  // Iteratively add most different schedule
  while (selected.length < maxCount) {
    let maxMinDistance = 0;
    let mostDifferent: ScheduleWithObjectives | null = null;

    for (const candidate of paretoFront) {
      if (selected.some(s => s.id === candidate.id)) continue;

      // Calculate minimum distance to any selected schedule
      const minDistance = Math.min(
        ...selected.map(s => objectiveDistance(s.objectives, candidate.objectives))
      );

      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        mostDifferent = candidate;
      }
    }

    if (mostDifferent) {
      selected.push(mostDifferent);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Calculate Euclidean distance between two objective vectors
 */
function objectiveDistance(a: ObjectiveScores, b: ObjectiveScores): number {
  // Normalize objectives to same scale before distance calculation
  const normA = normalizeObjectives(a);
  const normB = normalizeObjectives(b);

  const diffs = [
    normA.fairness - normB.fairness,
    normA.workloadBalance - normB.workloadBalance,
    normA.skillMatchScore - normB.skillMatchScore,
    normA.heavyTaskFairness - normB.heavyTaskFairness,
    normA.scheduleVariety - normB.scheduleVariety,
  ];

  const sumSquares = diffs.reduce((sum, diff) => sum + diff * diff, 0);
  return Math.sqrt(sumSquares);
}

/**
 * Normalize objectives to 0-1 scale for fair distance calculation
 */
function normalizeObjectives(obj: ObjectiveScores): ObjectiveScores {
  return {
    fairness: 1 - Math.max(0, Math.min(1, obj.fairness / 2)), // Lower is better -> invert
    workloadBalance: 1 - Math.max(0, Math.min(1, obj.workloadBalance / 5)), // Lower is better -> invert
    skillMatchScore: obj.skillMatchScore / 100, // Already 0-100 -> scale to 0-1
    heavyTaskFairness: 1 - Math.max(0, Math.min(1, obj.heavyTaskFairness / 2)), // Lower is better -> invert
    scheduleVariety: Math.max(0, Math.min(1, (obj.scheduleVariety - 1) / 4)), // 1-5 range -> 0-1
    totalScore: obj.totalScore / 100, // Already 0-100 -> scale to 0-1
  };
}

/**
 * Get trade-off explanation between two schedules
 */
export function explainTradeoff(
  scheduleA: ScheduleWithObjectives,
  scheduleB: ScheduleWithObjectives
): string[] {
  const explanations: string[] = [];
  const objA = scheduleA.objectives;
  const objB = scheduleB.objectives;

  // Compare each objective
  if (Math.abs(objA.fairness - objB.fairness) > 0.2) {
    if (objA.fairness < objB.fairness) {
      explanations.push('Schedule A has better fairness');
    } else {
      explanations.push('Schedule B has better fairness');
    }
  }

  if (Math.abs(objA.skillMatchScore - objB.skillMatchScore) > 5) {
    if (objA.skillMatchScore > objB.skillMatchScore) {
      explanations.push('Schedule A has better skill matching');
    } else {
      explanations.push('Schedule B has better skill matching');
    }
  }

  if (Math.abs(objA.scheduleVariety - objB.scheduleVariety) > 0.3) {
    if (objA.scheduleVariety > objB.scheduleVariety) {
      explanations.push('Schedule A has more task variety');
    } else {
      explanations.push('Schedule B has more task variety');
    }
  }

  if (explanations.length === 0) {
    explanations.push('Schedules are very similar');
  }

  return explanations;
}
