import type {
  Block,
  Exercise,
  ListScreen,
  LoadSpec,
  RepSpec,
  TextListScreen,
  TrainingPlan,
  WeightUnit,
  WorkoutCursor,
} from "../types/contracts";
import { ACTION_LABELS } from "../config/constants";
import {
  getExerciseAtCursor,
  nextStep,
  peekNextExercise,
} from "./workoutEngine";

const MAX_NAME_LEN = 40;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

export function formatReps(r: RepSpec): string {
  switch (r.type) {
    case "fixed": return `${r.value} reps`;
    case "range": return `${r.min}-${r.max} reps`;
    case "toFailure": return "AMRAP";
    case "timed": return `${r.seconds}s hold`;
  }
}

export function formatLoad(l: LoadSpec, _unit?: WeightUnit): string {
  switch (l.type) {
    case "weight": return `${l.value}${l.unit}`;
    case "bodyweight": return "BW";
    case "rpe": return `RPE ${l.value}`;
    case "percentage": return `${l.value}%`;
    case "none": return "";
  }
}

/** Format a compact "name + prescription" for NEXT line. */
function formatNextPreview(next: { name: string; reps: string; load: string }): string {
  const parts = [next.load, next.reps].filter(Boolean).join(" ");
  return parts ? `${next.name} ${parts}` : next.name;
}

/**
 * Format the ACTIVE_EXERCISE screen.
 *
 * ┌─────────────────────────────────────────┐
 * │  Exercise 1/3 · Bench Press             │
 * │                                         │
 * │  NOW: BENCH PRESS 80KG 10 REPS         │
 * │  NEXT: Incline Fly 14kg 12 reps        │
 * │                                  63%    │
 * │                                         │
 * │  [ ✓ Done ]  [ Skip ]                   │
 * └─────────────────────────────────────────┘
 */
export function formatExerciseScreen(
  cursor: WorkoutCursor,
  plan: TrainingPlan,
  block: Block,
  exercise: Exercise,
  setsCompleted: number,
  totalSets: number,
): TextListScreen {
  const blockLine = `Block ${cursor.blockIndex + 1} out of ${plan.blocks.length} \u00B7 ${truncate(block.name, 32)}`;
  const divider = "-".repeat(39);
  const nowLine = `NOW: ${exercise.name.toUpperCase()} ${formatReps(exercise.prescribedReps).toUpperCase()} \u00B7 Set ${cursor.roundNumber}/${block.rounds}`;

  const nextResult = nextStep(cursor, plan);
  let nextLine = "Next: Workout Complete";
  if (!nextResult.done) {
    const nextInfo = getExerciseAtCursor(nextResult.cursor, plan);
    const nextBlockRounds = plan.blocks[nextResult.cursor.blockIndex]?.rounds ?? block.rounds;
    if (nextInfo) {
      nextLine = `Next: ${nextInfo.exercise.name} ${formatReps(nextInfo.exercise.prescribedReps)} \u00B7 Set ${nextResult.cursor.roundNumber}/${nextBlockRounds}`;
    }
  }

  const pct = totalSets > 0 ? Math.round((setsCompleted / totalSets) * 100) : 0;
  const footer = `${truncate(plan.name, 20)} \u00B7 ${pct}% Completed`;

  return {
    kind: "textList",
    content: [blockLine, "", divider, nowLine, divider, nextLine].join("\n"),
    actions: ["Done", ACTION_LABELS.skip],
    footer,
  };
}

/**
 * Format the REST / BLOCK_REST screen.
 *
 * ┌─────────────────────────────────────────┐
 * │  REST                                   │
 * │                                         │
 * │         1:15                            │
 * │                                         │
 * │  NEXT: Incline Fly 14kg 12 reps        │
 * │                                         │
 * │  [ Skip Rest ]                          │
 * └─────────────────────────────────────────┘
 */
export function formatRestScreen(
  remainingSeconds: number,
  cursor: WorkoutCursor,
  plan: TrainingPlan,
  isBlockRest: boolean,
): TextListScreen {
  return {
    kind: "textList",
    content: formatRestTimerText(remainingSeconds, cursor, plan, isBlockRest),
    actions: [ACTION_LABELS.skipRest],
  };
}

/**
 * Format just the text content for rest timer ticks (used with updateText).
 * The action list stays unchanged during countdown.
 */
export function formatRestTimerText(
  remainingSeconds: number,
  cursor: WorkoutCursor,
  plan: TrainingPlan,
  isBlockRest: boolean,
): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  const header = isBlockRest ? "BLOCK REST" : "REST";

  // Preview next exercise with name + prescription
  const next = peekNextExercise(cursor, plan);
  const nextLine = next
    ? `NEXT: ${formatNextPreview(next)}`
    : "";

  const lines = [
    header,
    "",
    `       ${timeStr}`,
    "",
    nextLine,
  ];

  return lines.join("\n");
}

/**
 * Format the WORKOUT_COMPLETE screen.
 *
 * ┌─────────────────────────────────────────┐
 * │  WORKOUT COMPLETE ✓                     │
 * │                                         │
 * │  Push Day                               │
 * │  6/6 sets · 47min                       │
 * │                                         │
 * │  [ Done ]                               │
 * └─────────────────────────────────────────┘
 */
export function formatCompleteScreen(
  plan: TrainingPlan,
  durationSeconds: number,
  setsCompleted: number,
  totalSets: number,
): TextListScreen {
  const mins = Math.floor(durationSeconds / 60);
  const duration = `${mins}min`;

  const lines = [
    "WORKOUT COMPLETE \u2713",
    "",
    truncate(plan.name, MAX_NAME_LEN),
    `${setsCompleted}/${totalSets} sets \u00B7 ${duration}`,
  ];

  return {
    kind: "textList",
    content: lines.join("\n"),
    actions: [ACTION_LABELS.dismiss],
  };
}

/**
 * Format the PAUSED screen.
 */
export function formatPausedScreen(
  plan: TrainingPlan,
): TextListScreen {
  const lines = [
    "PAUSED",
    "",
    truncate(plan.name, MAX_NAME_LEN),
  ];

  return {
    kind: "textList",
    content: lines.join("\n"),
    actions: ["Resume"],
  };
}

/**
 * Format the ROUTINE_SELECT screen (full-page list).
 */
export function formatRoutineSelectScreen(
  plans: TrainingPlan[],
): ListScreen {
  return {
    kind: "list",
    title: "SELECT ROUTINE",
    items: plans.map((p) => p.name),
  };
}
