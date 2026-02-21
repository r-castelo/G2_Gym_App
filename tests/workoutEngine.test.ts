import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blockSetProgress,
  nextStep,
  countTotalSets,
  countTotalExercises,
  flatSetIndex,
  flatExerciseIndex,
  getExerciseAtCursor,
  peekNextExercise,
} from "../src/domain/workoutEngine";
import type { TrainingPlan, WorkoutCursor } from "../src/types/contracts";

function makePlan(overrides?: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: "plan-1",
    name: "Test Plan",
    blocks: [
      {
        id: "b1",
        name: "Block A",
        blockType: "straight",
        rounds: 3,
        restBetweenExercises: 0,
        restBetweenRounds: 60,
        restAfterBlock: 90,
        exercises: [
          { id: "e1", name: "Bench Press", prescribedReps: { type: "fixed", value: 10 }, prescribedLoad: { type: "weight", value: 80, unit: "kg" } },
        ],
      },
      {
        id: "b2",
        name: "Block B",
        blockType: "superset",
        rounds: 2,
        restBetweenExercises: 0,
        restBetweenRounds: 45,
        restAfterBlock: 60,
        exercises: [
          { id: "e2", name: "Curl", prescribedReps: { type: "fixed", value: 12 }, prescribedLoad: { type: "weight", value: 10, unit: "kg" } },
          { id: "e3", name: "Tricep Ext", prescribedReps: { type: "range", min: 8, max: 12 }, prescribedLoad: { type: "weight", value: 12, unit: "kg" } },
        ],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("nextStep", () => {
  it("advances to next round in a straight set block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.blockIndex, 0);
      assert.equal(result.cursor.exerciseIndex, 0);
      assert.equal(result.cursor.roundNumber, 2);
      assert.equal(result.restSeconds, 60);
    }
  });

  it("advances to next block after last round", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 3, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.blockIndex, 1);
      assert.equal(result.cursor.exerciseIndex, 0);
      assert.equal(result.cursor.roundNumber, 1);
      assert.equal(result.restSeconds, 90); // restAfterBlock
    }
  });

  it("advances to next exercise in superset", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.blockIndex, 1);
      assert.equal(result.cursor.exerciseIndex, 1);
      assert.equal(result.cursor.roundNumber, 1);
      assert.equal(result.restSeconds, 0); // restBetweenExercises is 0
    }
  });

  it("advances to next round in superset after last exercise", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 1, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.blockIndex, 1);
      assert.equal(result.cursor.exerciseIndex, 0);
      assert.equal(result.cursor.roundNumber, 2);
      assert.equal(result.restSeconds, 45); // restBetweenRounds
    }
  });

  it("completes workout on last exercise of last block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 2, phase: "exercise" };
    const result = nextStep(cursor, plan);
    assert.equal(result.done, true);
  });

  it("handles superset with exercise rest > 0", () => {
    const plan = makePlan();
    plan.blocks[1]!.restBetweenExercises = 15;
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.phase, "rest");
      assert.equal(result.restSeconds, 15);
    }
  });

  it("handles zero rest (skip rest phase)", () => {
    const plan = makePlan();
    plan.blocks[0]!.restBetweenRounds = 0;
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const result = nextStep(cursor, plan);

    assert.equal(result.done, false);
    if (!result.done) {
      assert.equal(result.cursor.phase, "exercise");
      assert.equal(result.restSeconds, 0);
    }
  });
});

describe("countTotalSets", () => {
  it("counts all exercise-round combinations", () => {
    const plan = makePlan();
    // Block A: 1 exercise x 3 rounds = 3
    // Block B: 2 exercises x 2 rounds = 4
    assert.equal(countTotalSets(plan), 7);
  });
});

describe("flatSetIndex", () => {
  it("returns 1 for first exercise", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    assert.equal(flatSetIndex(cursor, plan), 1);
  });

  it("returns correct index for second round", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 2, phase: "exercise" };
    assert.equal(flatSetIndex(cursor, plan), 2);
  });

  it("returns correct index for second block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    assert.equal(flatSetIndex(cursor, plan), 4); // 3 from block A + 1
  });

  it("returns correct index for second exercise in second block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 1, phase: "exercise" };
    assert.equal(flatSetIndex(cursor, plan), 5);
  });
});

describe("blockSetProgress", () => {
  it("tracks per-block set index across exercises and rounds", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 2, phase: "exercise" };
    const progress = blockSetProgress(cursor, plan);
    // Block B has 2 exercises x 2 rounds => 4 total sets in block
    // Round 2, exercise 1 => set 3/4
    assert.equal(progress.current, 3);
    assert.equal(progress.total, 4);
  });

  it("matches rounds when block has a single exercise", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 2, phase: "exercise" };
    const progress = blockSetProgress(cursor, plan);
    assert.equal(progress.current, 2);
    assert.equal(progress.total, 3);
  });
});

describe("countTotalExercises", () => {
  it("counts unique exercises across all blocks", () => {
    const plan = makePlan();
    // Block A: 1 exercise, Block B: 2 exercises
    assert.equal(countTotalExercises(plan), 3);
  });

  it("returns 0 for empty plan", () => {
    const plan = makePlan({ blocks: [] });
    assert.equal(countTotalExercises(plan), 0);
  });
});

describe("flatExerciseIndex", () => {
  it("returns 1 for first exercise", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    assert.equal(flatExerciseIndex(cursor, plan), 1);
  });

  it("returns correct index for first exercise in second block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    assert.equal(flatExerciseIndex(cursor, plan), 2); // 1 from block A + 1
  });

  it("returns correct index for second exercise in second block", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 1, phase: "exercise" };
    assert.equal(flatExerciseIndex(cursor, plan), 3); // 1 from block A + 2
  });

  it("is round-independent", () => {
    const plan = makePlan();
    const cursor1: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const cursor2: WorkoutCursor = { blockIndex: 0, exerciseIndex: 0, roundNumber: 3, phase: "exercise" };
    assert.equal(flatExerciseIndex(cursor1, plan), flatExerciseIndex(cursor2, plan));
  });
});

describe("getExerciseAtCursor", () => {
  it("returns correct exercise", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 1, phase: "exercise" };
    const result = getExerciseAtCursor(cursor, plan);
    assert.ok(result);
    assert.equal(result.exercise.name, "Tricep Ext");
    assert.equal(result.blockName, "Block B");
  });

  it("returns null for out of bounds", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 5, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    assert.equal(getExerciseAtCursor(cursor, plan), null);
  });
});

describe("peekNextExercise", () => {
  it("peeks at next exercise in superset", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 0, roundNumber: 1, phase: "exercise" };
    const result = peekNextExercise(cursor, plan);
    assert.ok(result);
    assert.equal(result.name, "Tricep Ext");
  });

  it("returns null on last set of workout", () => {
    const plan = makePlan();
    const cursor: WorkoutCursor = { blockIndex: 1, exerciseIndex: 1, roundNumber: 2, phase: "exercise" };
    assert.equal(peekNextExercise(cursor, plan), null);
  });
});
