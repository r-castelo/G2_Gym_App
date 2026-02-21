import type { Block, Exercise, LoadSpec, RepSpec, TrainingPlan } from "../types/contracts";

/**
 * Serialize a TrainingPlan back to the workout markdown format.
 */
export function exportToMarkdown(plan: TrainingPlan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.name}`);
  lines.push("");

  for (const block of plan.blocks) {
    lines.push(formatBlockHeading(block));
    lines.push(`- rest: ${block.restBetweenRounds}s`);
    if (block.restAfterBlock > 0) {
      lines.push(`- block-rest: ${block.restAfterBlock}s`);
    }
    if (block.restBetweenExercises > 0) {
      lines.push(`- exercise-rest: ${block.restBetweenExercises}s`);
    }
    lines.push("");

    for (const exercise of block.exercises) {
      lines.push(`### ${exercise.name}`);
      lines.push(`- reps: ${formatRepSpec(exercise.prescribedReps)}`);
      const load = formatLoadSpec(exercise.prescribedLoad);
      if (load) {
        lines.push(`- load: ${load}`);
      }
      if (exercise.notes) {
        lines.push(`- notes: ${exercise.notes}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

function formatBlockHeading(block: Block): string {
  const parts: string[] = [`## ${block.name}`];

  if (block.blockType !== "straight") {
    parts.push(`[${block.blockType}]`);
  }

  if (block.rounds > 1) {
    parts.push(`x${block.rounds}`);
  }

  return parts.join(" ");
}

function formatRepSpec(r: RepSpec): string {
  switch (r.type) {
    case "fixed": return `${r.value}`;
    case "range": return `${r.min}-${r.max}`;
    case "toFailure": return "AMRAP";
    case "timed": return `${r.seconds}s`;
  }
}

function formatLoadSpec(l: LoadSpec): string {
  switch (l.type) {
    case "weight": return `${l.value}${l.unit}`;
    case "bodyweight": return "BW";
    case "rpe": return `RPE ${l.value}`;
    case "percentage": return `${l.value}%`;
    case "none": return "";
  }
}
