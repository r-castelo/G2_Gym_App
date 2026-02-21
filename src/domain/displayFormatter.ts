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
  countTotalExercises,
  countTotalSets,
  flatExerciseIndex,
  flatSetIndex,
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

function formatPrescriptionShort(exercise: Exercise): string {
  const load = formatLoad(exercise.prescribedLoad);
  const reps = formatReps(exercise.prescribedReps);
  if (load) {
    return `${load} ${reps}`;
  }
  return reps;
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
  const exNum = flatExerciseIndex(cursor, plan);
  const totalEx = countTotalExercises(plan);

  // Line 1: Context — position + name
  const contextLine = `Exercise ${exNum}/${totalEx} \u00B7 ${truncate(exercise.name, 30)}`;

  // Line 3: NOW — what to do right now (uppercase, prominent)
  const nowPrescription = formatPrescriptionShort(exercise);
  const nowLine = `NOW: ${exercise.name.toUpperCase()} ${nowPrescription.toUpperCase()}`;

  // Line 4: NEXT — what's coming
  const next = peekNextExercise(cursor, plan);
  const nextLine = next
    ? `NEXT: ${formatNextPreview(next)}`
    : "NEXT: Done!";

  // Line 5: Progress percentage (right-aligned feel)
  const pct = totalSets > 0 ? Math.round((setsCompleted / totalSets) * 100) : 0;
  const progressLine = `${pct}%`;

  const lines = [
    contextLine,
    "",
    nowLine,
    nextLine,
    progressLine,
  ];

  return {
    kind: "textList",
    content: lines.join("\n"),
    actions: [ACTION_LABELS.done, ACTION_LABELS.skip],
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
