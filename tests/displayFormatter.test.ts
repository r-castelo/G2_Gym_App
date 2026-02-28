import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatExerciseScreen,
  formatRestScreen,
  formatRestTimerText,
  formatCompleteScreen,
  formatPausedScreen,
  formatRoutineSelectScreen,
  formatReps,
  formatLoad,
} from "../src/domain/displayFormatter";
import type { TrainingPlan, WorkoutCursor } from "../src/types/contracts";

function makePlan(): TrainingPlan {
  return {
    id: "p1",
    name: "Push Day A",
    blocks: [
      {
        id: "b1",
        name: "Chest Superset",
        blockType: "superset",
        rounds: 3,
        restBetweenExercises: 0,
        restBetweenRounds: 60,
        restAfterBlock: 90,
        exercises: [
          { id: "e1", name: "Bench Press", prescribedReps: { type: "fixed", value: 10 }, prescribedLoad: { type: "weight", value: 80, unit: "kg" } },
          { id: "e2", name: "Incline Fly", prescribedReps: { type: "fixed", value: 12 }, prescribedLoad: { type: "weight", value: 14, unit: "kg" } },
        ],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("formatReps", () => {
  it("formats fixed reps", () => {
    assert.equal(formatReps({ type: "fixed", value: 10 }), "10 reps");
  });
  it("formats range", () => {
    assert.equal(formatReps({ type: "range", min: 8, max: 12 }), "8-12 reps");
  });
  it("formats AMRAP", () => {
    assert.equal(formatReps({ type: "toFailure" }), "AMRAP");
  });
  it("formats timed", () => {
    assert.equal(formatReps({ type: "timed", seconds: 60 }), "60s hold");
  });
});

describe("formatLoad", () => {
  it("formats weight", () => {
    assert.equal(formatLoad({ type: "weight", value: 80, unit: "kg" }), "80kg");
  });
  it("formats bodyweight", () => {
    assert.equal(formatLoad({ type: "bodyweight" }), "BW");
  });
  it("formats RPE", () => {
    assert.equal(formatLoad({ type: "rpe", value: 8 }), "RPE 8");
  });
  it("formats percentage", () => {
    assert.equal(formatLoad({ type: "percentage", value: 75 }), "75%");
  });
  it("formats none", () => {
    assert.equal(formatLoad({ type: "none" }), "");
  });
});

describe("formatExerciseScreen", () => {
  it("returns a TextListScreen with block context, NOW/NEXT set lines, and footer container text", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 2, phase: "exercise" };
    const block = plan.blocks[0]!;
    const exercise = block.exercises[0]!;

    const screen = formatExerciseScreen(cursor, plan, block, exercise, 2, 6);

    assert.equal(screen.kind, "textList");
    assert.ok(screen.content.includes("BLOCK 1/1 ■ · CHEST SUPERSET"));
    assert.ok(screen.content.includes("━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    assert.ok(screen.content.includes("▶ NOW:\n  ┃ BENCH PRESS\n  ┃ 10 REPS · 80KG"));
    assert.ok(screen.content.includes("▷ NEXT:\n  ┃ INCLINE FLY\n  ┃ 12 REPS · 14KG"));
    assert.equal(screen.theme, "exercise");
    assert.deepEqual(screen.actions, ["Done", "Skip"]);
    // 2 sets complete = 4 steps out of 12. 4/12 * 16 = 5.
    assert.equal(screen.footer, "Push Day A █████▒▒▒▒▒▒▒▒▒▒▒");
  });

  it("shows completion next line when there is no next set", () => {
    const plan = makePlan();
    // Last exercise of last round of last block
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 1, roundNumber: 3, phase: "exercise" };
    const block = plan.blocks[0]!;
    const exercise = block.exercises[1]!;

    const screen = formatExerciseScreen(cursor, plan, block, exercise, 5, 6);
    assert.ok(screen.content.includes("▷ NEXT: Workout Complete"));
  });

  it("shows 0% progress when no sets completed", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const block = plan.blocks[0]!;
    const exercise = block.exercises[0]!;

    const screen = formatExerciseScreen(cursor, plan, block, exercise, 0, 6);
    assert.equal(screen.footer, "Push Day A \u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592");
  });

  it("shows load token in NOW line when exercise uses bodyweight", () => {
    const plan = makePlan();
    plan.blocks[0]!.exercises[0]!.prescribedLoad = { type: "bodyweight" };
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const block = plan.blocks[0]!;
    const exercise = block.exercises[0]!;

    const screen = formatExerciseScreen(cursor, plan, block, exercise, 0, 6);
    assert.ok(screen.content.includes("\u25b6 NOW:\n  \u2503 BENCH PRESS\n  \u2503 10 REPS \u00b7 BW"));
  });
});

describe("formatRestScreen", () => {
  it("returns a workout-style TextListScreen with countdown, footer, and skip action", () => {
    const plan = makePlan();
    // Simulate rest after first set
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 1, roundNumber: 1, phase: "rest" };

    const screen = formatRestScreen(45, 60, cursor, plan, false);

    assert.equal(screen.kind, "textList");
    assert.ok(screen.content.includes("BLOCK 1/1 ■ · CHEST SUPERSET"));
    assert.ok(screen.content.includes("━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    // 15 seconds elapsed of 60. 15/60 * 10 = 2.5 => 3.
    assert.ok(screen.content.includes("▶ REST ── ███▒▒▒▒▒▒▒ 0:45"));
    assert.ok(screen.content.includes("▷ NEXT:\n  ┃ INCLINE FLY\n  ┃ 12 REPS · 14KG"));
    assert.deepEqual(screen.actions, ["Skip Rest"]);
    // 1 set complete + in rest = 1 step out of 12. 1/12 * 16 = 1.
    assert.equal(screen.footer, "Push Day A █▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒");
    assert.equal(screen.theme, "rest");
  });
});

describe("formatRestTimerText", () => {
  it("returns workout-style text with timer and next set line", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "rest" };

    const text = formatRestTimerText(30, 60, cursor, plan, false);

    assert.ok(text.includes("BLOCK 1/1 ■ · CHEST SUPERSET"));
    // 30 / 60 elapsed -> 5/10 filled
    assert.ok(text.includes("▶ REST ── █████▒▒▒▒▒ 0:30"));
  });

  it("shows exercise name prominently in Next line", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "rest" };

    const text = formatRestTimerText(60, 60, cursor, plan, false);

    assert.ok(text.includes("\u25b7 NEXT:\n  \u2503 BENCH PRESS"));
  });

  it("shows BLOCK REST timer line for block rest", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "blockRest" };

    const text = formatRestTimerText(90, 90, cursor, plan, true);
    assert.ok(text.includes("\u25b6 BLOCK REST \u2500\u2500 \u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592\u2592 1:30"));
  });

  it("includes reps and set progress in Next line", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "rest" };

    const text = formatRestTimerText(60, 60, cursor, plan, false);

    assert.ok(text.includes("BENCH PRESS"));
    assert.ok(text.includes("10 REPS"));
    assert.ok(text.includes("80KG"));
  });
});

describe("formatCompleteScreen", () => {
  it("returns a TextListScreen with summary and dismiss action", () => {
    const plan = makePlan();
    const screen = formatCompleteScreen(plan, 2823, 6, 6);

    assert.equal(screen.kind, "textList");
    assert.ok(screen.content.includes("★ WORKOUT COMPLETE ★"));
    assert.ok(screen.content.includes("PUSH DAY A"));
    assert.ok(screen.content.includes("Total: 2 exercises · 6 sets"));
    assert.ok(screen.content.includes("Duration: 47min"));
    assert.deepEqual(screen.actions, ["Done"]);
  });
});

describe("formatPausedScreen", () => {
  it("returns a TextListScreen with resume action", () => {
    const plan = makePlan();
    const screen = formatPausedScreen(plan);

    assert.equal(screen.kind, "textList");
    assert.ok(screen.content.includes("▌▌ PAUSED"));
    assert.ok(screen.content.includes("PUSH DAY A"));
    assert.deepEqual(screen.actions, ["Resume"]);
  });
});

describe("formatRoutineSelectScreen", () => {
  it("returns a ListScreen with plan names", () => {
    const plans: TrainingPlan[] = [
      { id: "p1", name: "Push Day", blocks: [], createdAt: 0, updatedAt: 0 },
      { id: "p2", name: "Pull Day", blocks: [], createdAt: 0, updatedAt: 0 },
      { id: "p3", name: "Leg Day", blocks: [], createdAt: 0, updatedAt: 0 },
    ];

    const screen = formatRoutineSelectScreen(plans);

    assert.equal(screen.kind, "list");
    assert.equal(screen.title, "SELECT ROUTINE");
    assert.deepEqual(screen.items, ["Push Day", "Pull Day", "Leg Day"]);
  });
});
