import type { Operator, TaskType, WeekDay } from '../../types';
import type { ScheduleResult, ScheduleRequestData } from '../schedulingService';
import { generateSmartSchedule } from '../schedulingService';
import { calculateObjectives, type ObjectiveWeights, DEFAULT_WEIGHTS } from './objectiveCalculators';

/**
 * Configuration for Tabu Search optimization
 */
export interface TabuSearchOptions {
  maxIterations: number;        // Max iterations to run (default: 100)
  tabuListSize: number;          // Size of tabu memory (default: 20)
  objectiveWeights: ObjectiveWeights; // Weights for objective function
  timeoutMs?: number;            // Max execution time (default: 5000ms)
}

export const DEFAULT_TABU_OPTIONS: TabuSearchOptions = {
  maxIterations: 100,
  tabuListSize: 20,
  objectiveWeights: DEFAULT_WEIGHTS,
  timeoutMs: 5000,
};

/**
 * A move in the search space (swap two operator assignments)
 */
interface Move {
  day1: WeekDay;
  operatorId1: string;
  taskId1: string;
  day2: WeekDay;
  operatorId2: string;
  taskId2: string;
}

/**
 * Move with its resulting schedule and objective score
 */
interface ScoredMove {
  move: Move;
  schedule: ScheduleResult;
  objectiveScore: number;
}

/**
 * Circular buffer for tabu list (recent moves to avoid)
 */
class TabuList {
  private list: string[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  /**
   * Add a move to the tabu list
   */
  add(move: Move): void {
    const key = this.moveToKey(move);
    this.list.push(key);
    if (this.list.length > this.maxSize) {
      this.list.shift(); // Remove oldest
    }
  }

  /**
   * Check if a move is tabu (recently made)
   */
  contains(move: Move): boolean {
    const key = this.moveToKey(move);
    return this.list.includes(key);
  }

  /**
   * Convert move to unique string key
   */
  private moveToKey(move: Move): string {
    // Create symmetric key (swap A→B is same as swap B→A)
    const parts = [
      `${move.day1}:${move.operatorId1}:${move.taskId1}`,
      `${move.day2}:${move.operatorId2}:${move.taskId2}`,
    ].sort();
    return parts.join('<->');
  }

  /**
   * Clear the tabu list
   */
  clear(): void {
    this.list = [];
  }

  /**
   * Get current size
   */
  size(): number {
    return this.list.length;
  }
}

/**
 * Refine a schedule using Tabu Search metaheuristic
 *
 * Tabu Search explores the solution space by:
 * 1. Generate neighborhood (all possible swaps)
 * 2. Select best non-tabu move
 * 3. Add move to tabu list (prevent cycling)
 * 4. Apply aspiration criterion (override tabu if improves best)
 * 5. Repeat until max iterations or no improvement
 */
export function refineScheduleWithTabuSearch(
  initialSchedule: ScheduleResult,
  data: ScheduleRequestData,
  options: Partial<TabuSearchOptions> = {}
): ScheduleResult {
  const opts: TabuSearchOptions = {
    ...DEFAULT_TABU_OPTIONS,
    ...options,
  };

  const startTime = Date.now();

  // Initialize
  let currentSchedule = initialSchedule;
  let bestSchedule = initialSchedule;

  const currentObjectives = calculateObjectives(
    currentSchedule,
    data.operators,
    data.tasks,
    data.days,
    opts.objectiveWeights
  );
  let bestObjectiveScore = currentObjectives.totalScore;

  const tabuList = new TabuList(opts.tabuListSize);
  let iterationsWithoutImprovement = 0;
  const maxStagnation = 20; // Stop if no improvement for 20 iterations

  // Main search loop
  for (let iter = 0; iter < opts.maxIterations; iter++) {
    // Check timeout
    if (opts.timeoutMs && Date.now() - startTime > opts.timeoutMs) {
      console.log(`Tabu Search timeout after ${iter} iterations`);
      break;
    }

    // Generate neighborhood (all possible swaps)
    const neighbors = generateNeighborhood(currentSchedule, data);

    if (neighbors.length === 0) {
      console.log('No valid neighbors found, stopping');
      break;
    }

    // Score each neighbor
    const scoredNeighbors: ScoredMove[] = neighbors.map(neighbor => {
      const objectives = calculateObjectives(
        neighbor.schedule,
        data.operators,
        data.tasks,
        data.days,
        opts.objectiveWeights
      );
      return {
        move: neighbor.move,
        schedule: neighbor.schedule,
        objectiveScore: objectives.totalScore,
      };
    });

    // Sort by score (descending)
    scoredNeighbors.sort((a, b) => b.objectiveScore - a.objectiveScore);

    // Find best non-tabu move (with aspiration criterion)
    let selectedMove: ScoredMove | null = null;

    for (const neighbor of scoredNeighbors) {
      const isTabu = tabuList.contains(neighbor.move);
      const improvesGlobal = neighbor.objectiveScore > bestObjectiveScore;

      // Accept if: not tabu OR (is tabu but improves global best - aspiration)
      if (!isTabu || improvesGlobal) {
        selectedMove = neighbor;
        break;
      }
    }

    // If all moves are tabu and none improve global best, stop
    if (!selectedMove) {
      console.log('All moves tabu and no aspiration, stopping');
      break;
    }

    // Apply selected move
    currentSchedule = selectedMove.schedule;
    tabuList.add(selectedMove.move);

    // Update best if improved
    if (selectedMove.objectiveScore > bestObjectiveScore) {
      bestSchedule = selectedMove.schedule;
      bestObjectiveScore = selectedMove.objectiveScore;
      iterationsWithoutImprovement = 0;
    } else {
      iterationsWithoutImprovement++;
    }

    // Early stop if stagnated
    if (iterationsWithoutImprovement >= maxStagnation) {
      console.log(`Tabu Search stagnated after ${iter} iterations`);
      break;
    }
  }

  const endTime = Date.now();
  console.log(`Tabu Search completed in ${endTime - startTime}ms`);
  console.log(`Initial score: ${currentObjectives.totalScore}, Final score: ${bestObjectiveScore}`);

  return bestSchedule;
}

/**
 * Generate all valid neighboring solutions (swap moves)
 */
function generateNeighborhood(
  schedule: ScheduleResult,
  data: ScheduleRequestData
): Array<{ move: Move; schedule: ScheduleResult }> {
  const neighbors: Array<{ move: Move; schedule: ScheduleResult }> = [];

  // Try swapping assignments between different operators on same or different days
  for (let i = 0; i < schedule.assignments.length; i++) {
    for (let j = i + 1; j < schedule.assignments.length; j++) {
      const assign1 = schedule.assignments[i];
      const assign2 = schedule.assignments[j];

      // Skip if same operator (no point swapping with self)
      if (assign1.operatorId === assign2.operatorId) continue;

      // Create swap move
      const move: Move = {
        day1: assign1.day,
        operatorId1: assign1.operatorId,
        taskId1: assign1.taskId,
        day2: assign2.day,
        operatorId2: assign2.operatorId,
        taskId2: assign2.taskId,
      };

      // Apply swap and validate
      const newSchedule = applySwap(schedule, i, j);
      if (isValidSwap(newSchedule, move, data)) {
        neighbors.push({ move, schedule: newSchedule });
      }
    }
  }

  return neighbors;
}

/**
 * Apply a swap move to a schedule
 */
function applySwap(
  schedule: ScheduleResult,
  index1: number,
  index2: number
): ScheduleResult {
  const newAssignments = [...schedule.assignments];

  // Swap operator assignments
  const temp = newAssignments[index1].operatorId;
  newAssignments[index1] = {
    ...newAssignments[index1],
    operatorId: newAssignments[index2].operatorId,
  };
  newAssignments[index2] = {
    ...newAssignments[index2],
    operatorId: temp,
  };

  return {
    assignments: newAssignments,
    warnings: [], // Will be recalculated if needed
  };
}

/**
 * Check if a swap move is valid (respects constraints)
 */
function isValidSwap(
  schedule: ScheduleResult,
  move: Move,
  data: ScheduleRequestData
): boolean {
  // Get operators involved
  const op1 = data.operators.find(op => op.id === move.operatorId2); // Note: IDs swapped
  const op2 = data.operators.find(op => op.id === move.operatorId1);

  if (!op1 || !op2) return false;

  // Get tasks involved
  const task1 = data.tasks.find(t => t.id === move.taskId1);
  const task2 = data.tasks.find(t => t.id === move.taskId2);

  if (!task1 || !task2) return false;

  // Validate hard constraints

  // 1. Skill matching (if strict mode)
  if (data.rules?.strictSkillMatching) {
    if (!op1.skills.includes(task1.requiredSkill)) return false;
    if (!op2.skills.includes(task2.requiredSkill)) return false;
  }

  // 2. Availability
  if (!op1.availability[move.day1]) return false;
  if (!op2.availability[move.day2]) return false;

  // 3. Coordinator restrictions
  const COORDINATOR_TASKS = ['People', 'Process', 'Off process', 'Off Process'];
  if (op1.type === 'Coordinator') {
    const isCoordinatorTask1 = COORDINATOR_TASKS.some(ct =>
      task1.name.toLowerCase().includes(ct.toLowerCase())
    );
    if (!isCoordinatorTask1) return false;
  }
  if (op2.type === 'Coordinator') {
    const isCoordinatorTask2 = COORDINATOR_TASKS.some(ct =>
      task2.name.toLowerCase().includes(ct.toLowerCase())
    );
    if (!isCoordinatorTask2) return false;
  }

  // 4. No double assignment (operator assigned twice same day)
  const op1Assignments = schedule.assignments.filter(
    a => a.operatorId === move.operatorId2 && a.day === move.day1
  );
  const op2Assignments = schedule.assignments.filter(
    a => a.operatorId === move.operatorId1 && a.day === move.day2
  );

  // After swap, neither operator should have multiple assignments same day
  if (move.day1 === move.day2 && op1Assignments.length > 1) return false;
  if (move.day1 === move.day2 && op2Assignments.length > 1) return false;

  return true;
}

/**
 * Quick helper to refine a schedule with default options
 */
export function quickRefine(
  schedule: ScheduleResult,
  data: ScheduleRequestData
): ScheduleResult {
  return refineScheduleWithTabuSearch(schedule, data, {
    maxIterations: 50, // Quick version
    tabuListSize: 15,
  });
}
