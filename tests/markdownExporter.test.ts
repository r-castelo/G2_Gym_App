import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWorkoutMarkdown } from "../src/domain/markdownImporter";
import { exportToMarkdown } from "../src/domain/markdownExporter";

describe("markdownExporter", () => {
  it("round-trips a basic plan", () => {
    const original = `# Push Day A

## Chest x3
- rest: 60s
- block-rest: 90s

### Bench Press
- reps: 10
- load: 80kg
- notes: Pause at bottom

## Arms [superset] x2
- rest: 45s
- block-rest: 60s

### Curl
- reps: 12
- load: 10kg

### Tricep Extension
- reps: 8-12
- load: RPE 8
`;

    const plan = parseWorkoutMarkdown(original);
    const exported = exportToMarkdown(plan);

    // Re-parse the exported markdown
    const reParsed = parseWorkoutMarkdown(exported);

    assert.equal(reParsed.name, plan.name);
    assert.equal(reParsed.blocks.length, plan.blocks.length);

    for (let i = 0; i < plan.blocks.length; i++) {
      const origBlock = plan.blocks[i]!;
      const reBlock = reParsed.blocks[i]!;

      assert.equal(reBlock.name, origBlock.name);
      assert.equal(reBlock.blockType, origBlock.blockType);
      assert.equal(reBlock.rounds, origBlock.rounds);
      assert.equal(reBlock.restBetweenRounds, origBlock.restBetweenRounds);
      assert.equal(reBlock.restAfterBlock, origBlock.restAfterBlock);
      assert.equal(reBlock.exercises.length, origBlock.exercises.length);

      for (let j = 0; j < origBlock.exercises.length; j++) {
        const origEx = origBlock.exercises[j]!;
        const reEx = reBlock.exercises[j]!;

        assert.equal(reEx.name, origEx.name);
        assert.deepEqual(reEx.prescribedReps, origEx.prescribedReps);
        assert.deepEqual(reEx.prescribedLoad, origEx.prescribedLoad);
      }
    }
  });

  it("exports AMRAP and bodyweight correctly", () => {
    const md = `# Core

## Plank Set [straight] x2
- rest: 30s
- block-rest: 0s

### Plank
- reps: 60s
- load: BW

### Pushups
- reps: AMRAP
`;

    const plan = parseWorkoutMarkdown(md);
    const exported = exportToMarkdown(plan);

    assert.ok(exported.includes("- reps: 60s"));
    assert.ok(exported.includes("- load: BW"));
    assert.ok(exported.includes("- reps: AMRAP"));
  });
});
