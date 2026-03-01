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
  blockSetProgress,
  countTotalExercises,
  countTotalSets,
  flatSetIndex,
  getExerciseAtCursor,
  nextStep,
} from "./workoutEngine";

const MAX_NAME_LEN = 40;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

function makeContinuousBar(current: number, total: number, length = 16): string {
  if (total <= 0) return '▒'.repeat(length);
  const filled = Math.min(length, Math.max(0, Math.round((current / total) * length)));
  const empty = length - filled;
  return '█'.repeat(filled) + '▒'.repeat(empty);
}

function makeDiscreteBar(current: number, total: number, maxLen = 8): string {
  if (total <= 0) return '';
  if (total > maxLen) {
     const filled = Math.min(maxLen, Math.max(0, Math.round((current / total) * maxLen)));
     return '■'.repeat(filled) + '□'.repeat(maxLen - filled);
  }
  const safeCurrent = Math.min(current, total);
  return '■'.repeat(safeCurrent) + '□'.repeat(total - safeCurrent);
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
 * │  [ Done ]  [ Skip ]                     │
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
  const blockBar = makeDiscreteBar(cursor.blockIndex + 1, plan.blocks.length, 6);
  const blockLine = `BLOCK ${cursor.blockIndex + 1}/${plan.blocks.length} ${blockBar} · ${truncate(block.name, 16).toUpperCase()}`;
  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━";
  const currentSet = blockSetProgress(cursor, plan);
  const setBar = makeDiscreteBar(currentSet.current, currentSet.total, 8);
  const nowLoad = formatLoad(exercise.prescribedLoad);
  const nowLoadPart = nowLoad ? ` · ${nowLoad.toUpperCase()}` : "";
  
  // Use vertical bar to simulate a highlighted container block
  const nowLine = `▶ NOW:\n  ┃ ${exercise.name.toUpperCase()}\n  ┃ ${formatReps(exercise.prescribedReps).toUpperCase()}${nowLoadPart}`;

  const nextResult = nextStep(cursor, plan);
  let nextLine = "▷ NEXT: Workout Complete";
  if (!nextResult.done) {
    const nextInfo = getExerciseAtCursor(nextResult.cursor, plan);
    if (nextInfo) {
      const nextLoad = formatLoad(nextInfo.exercise.prescribedLoad);
      const nextLoadPart = nextLoad ? ` · ${nextLoad.toUpperCase()}` : "";
      nextLine = `▷ NEXT:\n  ┃ ${truncate(nextInfo.exercise.name, 16).toUpperCase()}\n  ┃ ${formatReps(nextInfo.exercise.prescribedReps).toUpperCase()}${nextLoadPart}`;
    }
  }

  // Multiply by 2 so completing a rest advances the bar as well
  const stepsCompleted = setsCompleted * 2;
  const totalSteps = totalSets * 2;
  const footerBar = makeContinuousBar(stepsCompleted, totalSteps, 16);
  const footer = `${truncate(plan.name, 12)} ${footerBar}`;

  return {
    kind: "textList",
    content: [
      blockLine,
      `Set ${currentSet.current}/${currentSet.total}  ${setBar}`,
      divider,
      nowLine,
      nextLine
    ].join("\n"),
    actions: [ACTION_LABELS.done, ACTION_LABELS.skip],
    footer,
    theme: "exercise"
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
  totalSeconds: number,
  cursor: WorkoutCursor,
  plan: TrainingPlan,
  isBlockRest: boolean,
): TextListScreen {
  const totalSets = countTotalSets(plan);
  const estimatedCompleted = flatSetIndex(cursor, plan) - 1;
  const setsCompleted = Math.max(0, Math.min(totalSets, estimatedCompleted));
  
  // We are currently IN the rest block, so add 1 step
  const stepsCompleted = Math.max(0, setsCompleted * 2 - 1);
  const totalSteps = totalSets * 2;
  const footerBar = makeContinuousBar(stepsCompleted, totalSteps, 16);
  const footer = `${truncate(plan.name, 12)} ${footerBar}`;

  return {
    kind: "textList",
    content: formatRestTimerText(remainingSeconds, totalSeconds, cursor, plan, isBlockRest),
    actions: ["Skip Rest"],
    footer,
    theme: "rest",
  };
}

/**
 * Format just the text content for rest timer ticks (used with updateText).
 * The action list stays unchanged during countdown.
 */
export function formatRestTimerText(
  remainingSeconds: number,
  totalSeconds: number,
  cursor: WorkoutCursor,
  plan: TrainingPlan,
  isBlockRest: boolean,
): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━";
  const block = plan.blocks[cursor.blockIndex];
  
  const blockBar = makeDiscreteBar(cursor.blockIndex + 1, plan.blocks.length, 6);
  const blockName = block?.name || `Block ${cursor.blockIndex + 1}`;
  const blockLine = `BLOCK ${cursor.blockIndex + 1}/${plan.blocks.length} ${blockBar} · ${truncate(blockName, 16).toUpperCase()}`;

  const restLabel = isBlockRest ? "BLOCK REST" : "REST";
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  const restBar = makeContinuousBar(elapsed, totalSeconds, 10);
  const timerLine = `▶ ${restLabel} ── ${restBar} ${timeStr}`;

  const nextInfo = getExerciseAtCursor(cursor, plan);
  let nextLine = "▷ NEXT: Workout Complete";
  if (nextInfo) {
    const nextLoad = formatLoad(nextInfo.exercise.prescribedLoad);
    const nextLoadPart = nextLoad ? ` · ${nextLoad.toUpperCase()}` : "";
    // Emphasize the upcoming exercise just like we highlight "NOW"
    nextLine = `▷ NEXT:\n  ┃ ${nextInfo.exercise.name.toUpperCase()}\n  ┃ ${formatReps(nextInfo.exercise.prescribedReps).toUpperCase()}${nextLoadPart}`;
  }

  const lines = [
    blockLine,
    divider,
    timerLine,
    divider,
    nextLine,
  ];

  return lines.join("\n");
}

/**
 * Format the WORKOUT_COMPLETE screen.
 *
 * ┌─────────────────────────────────────────┐
 * │  WORKOUT COMPLETE                       │
 * │                                         │
 * │  Push Day                               │
 * │  5 exercises · 20 sets                  │
 * │  Duration: 47min                        │
 * │                                         │
 * │  [ Done ]                               │
 * └─────────────────────────────────────────┘
 */
export function formatCompleteScreen(
  plan: TrainingPlan,
  durationSeconds: number,
  _setsCompleted: number,
  totalSets: number,
): TextListScreen {
  const mins = Math.floor(durationSeconds / 60);
  const duration = `${mins}min`;
  const totalExercises = countTotalExercises(plan);
  const exerciseLabel = totalExercises === 1 ? "exercise" : "exercises";
  const setLabel = totalSets === 1 ? "set" : "sets";

  const lines = [
    "WORKOUT COMPLETE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━",
    truncate(plan.name, MAX_NAME_LEN).toUpperCase(),
    `Total: ${totalExercises} ${exerciseLabel} · ${totalSets} ${setLabel}`,
    `Duration: ${duration}`,
  ];

  return {
    kind: "textList",
    content: lines.join("\n"),
    actions: [ACTION_LABELS.done],
  };
}

/**
 * Format the PAUSED screen.
 */
export function formatPausedScreen(
  plan: TrainingPlan,
): TextListScreen {
  const lines = [
    "▌▌ PAUSED",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━",
    truncate(plan.name, MAX_NAME_LEN).toUpperCase(),
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
