import type { Block, Exercise, TrainingPlan, WorkoutCursor } from "../types/contracts";

export type StepResult =
  | { done: false; cursor: WorkoutCursor; restSeconds: number }
  | { done: true };

/**
 * Given the current cursor and plan, compute the next step after the user
 * completes the current exercise set.
 *
 * Advancement order within a block (e.g., superset [A, B, C] x3):
 *   Round 1: A → rest(betweenExercises) → B → rest(betweenExercises) → C → rest(betweenRounds)
 *   Round 2: A → ... → C → rest(betweenRounds)
 *   Round 3: A → ... → C → rest(afterBlock)
 *   → next block
 */
export function nextStep(cursor: WorkoutCursor, plan: TrainingPlan): StepResult {
  const block = plan.blocks[cursor.blockIndex];
  if (!block) return { done: true };

  const isLastExerciseInRound = cursor.exerciseIndex >= block.exercises.length - 1;
  const isLastRound = cursor.roundNumber >= block.rounds;
  const isLastBlock = cursor.blockIndex >= plan.blocks.length - 1;

  // Case 1: More exercises in this round
  if (!isLastExerciseInRound) {
    return {
      done: false,
      cursor: {
        blockIndex: cursor.blockIndex,
        exerciseIndex: cursor.exerciseIndex + 1,
        roundNumber: cursor.roundNumber,
        phase: block.restBetweenExercises > 0 ? "rest" : "exercise",
      },
      restSeconds: block.restBetweenExercises,
    };
  }

  // Case 2: Last exercise in round, but more rounds in this block
  if (!isLastRound) {
    return {
      done: false,
      cursor: {
        blockIndex: cursor.blockIndex,
        exerciseIndex: 0,
        roundNumber: cursor.roundNumber + 1,
        phase: block.restBetweenRounds > 0 ? "rest" : "exercise",
      },
      restSeconds: block.restBetweenRounds,
    };
  }

  // Case 3: Last round of this block, but more blocks in the plan
  if (!isLastBlock) {
    return {
      done: false,
      cursor: {
        blockIndex: cursor.blockIndex + 1,
        exerciseIndex: 0,
        roundNumber: 1,
        phase: block.restAfterBlock > 0 ? "blockRest" : "exercise",
      },
      restSeconds: block.restAfterBlock,
    };
  }

  // Case 4: Last exercise, last round, last block — workout complete
  return { done: true };
}

/** Count total sets in a plan (each exercise in each round counts as one set). */
export function countTotalSets(plan: TrainingPlan): number {
  let total = 0;
  for (const block of plan.blocks) {
    total += block.exercises.length * block.rounds;
  }
  return total;
}

/** Get the exercise at a given cursor position, or null if out of bounds. */
export function getExerciseAtCursor(
  cursor: WorkoutCursor,
  plan: TrainingPlan,
): { blockName: string; exercise: Exercise; block: Block } | null {
  const block = plan.blocks[cursor.blockIndex];
  if (!block) return null;
  const exercise = block.exercises[cursor.exerciseIndex];
  if (!exercise) return null;
  return { blockName: block.name, exercise, block };
}

/** Peek at the next exercise without advancing (for "Next:" preview). */
export function peekNextExercise(
  cursor: WorkoutCursor,
  plan: TrainingPlan,
): { name: string; reps: string; load: string } | null {
  const result = nextStep(cursor, plan);
  if (result.done) return null;

  const nextCursor: WorkoutCursor = {
    ...result.cursor,
    phase: "exercise",
  };
  const info = getExerciseAtCursor(nextCursor, plan);
  if (!info) return null;

  // Import would be circular, so do minimal formatting here
  const reps = formatRepSpecShort(info.exercise.prescribedReps);
  const load = formatLoadSpecShort(info.exercise.prescribedLoad);

  return { name: info.exercise.name, reps, load };
}

function formatRepSpecShort(r: import("../types/contracts").RepSpec): string {
  switch (r.type) {
    case "fixed": return `${r.value}`;
    case "range": return `${r.min}-${r.max}`;
    case "toFailure": return "AMRAP";
    case "timed": return `${r.seconds}s`;
  }
}

function formatLoadSpecShort(l: import("../types/contracts").LoadSpec): string {
  switch (l.type) {
    case "weight": return `${l.value}${l.unit}`;
    case "bodyweight": return "BW";
    case "rpe": return `RPE ${l.value}`;
    case "percentage": return `${l.value}%`;
    case "none": return "";
  }
}

/** Count total unique exercises across the plan (ignoring rounds). */
export function countTotalExercises(plan: TrainingPlan): number {
  let count = 0;
  for (const block of plan.blocks) {
    count += block.exercises.length;
  }
  return count;
}

/** 1-based exercise index across all blocks at the cursor position. */
export function flatExerciseIndex(cursor: WorkoutCursor, plan: TrainingPlan): number {
  let index = 0;
  for (let b = 0; b < cursor.blockIndex; b++) {
    const block = plan.blocks[b];
    if (block) {
      index += block.exercises.length;
    }
  }
  index += cursor.exerciseIndex;
  return index + 1;
}

/** Compute a flat set index (1-based) from a cursor for progress display. */
export function flatSetIndex(cursor: WorkoutCursor, plan: TrainingPlan): number {
  let index = 0;
  for (let b = 0; b < cursor.blockIndex; b++) {
    const block = plan.blocks[b];
    if (block) {
      index += block.exercises.length * block.rounds;
    }
  }
  const currentBlock = plan.blocks[cursor.blockIndex];
  if (currentBlock) {
    index += (cursor.roundNumber - 1) * currentBlock.exercises.length;
    index += cursor.exerciseIndex;
  }
  return index + 1;
}
