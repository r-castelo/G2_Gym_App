import { DEFAULTS } from "../config/constants";
import type {
  Block,
  BlockType,
  Exercise,
  LoadSpec,
  RepSpec,
  TrainingPlan,
} from "../types/contracts";

let idCounter = 0;
function genId(): string {
  return `${Date.now()}-${++idCounter}`;
}

/**
 * Parse a workout markdown string into a TrainingPlan.
 * Throws on critical errors (no plan name, no blocks).
 *
 * Format:
 *   # Plan Name
 *   ## Block Name [type] xN
 *   - rest: 60s
 *   - block-rest: 90s
 *   - exercise-rest: 10s (legacy alias for rest)
 *   ### Exercise Name
 *   - reps: 10 | 8-12 | AMRAP | 30s
 *   - load: 80kg | 35lb | BW | RPE 8 | 75%
 *   - notes: optional
 */
export function parseWorkoutMarkdown(raw: string): TrainingPlan {
  idCounter = 0;
  const lines = raw.split("\n");

  let planName = "";
  const blocks: Block[] = [];
  let currentBlock: Partial<Block> | null = null;
  let currentExercise: Partial<Exercise> | null = null;
  let contextTarget: "block" | "exercise" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // # Plan Name
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      planName = line.slice(2).trim();
      continue;
    }

    // ## Block Name [type] xN
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      flushExercise();
      flushBlock();
      currentBlock = parseBlockHeading(line.slice(3).trim());
      contextTarget = "block";
      continue;
    }

    // ### Exercise Name
    if (line.startsWith("### ")) {
      flushExercise();
      currentExercise = {
        id: genId(),
        name: line.slice(4).trim(),
        prescribedReps: { type: "fixed", value: 10 },
        prescribedLoad: { type: "none" },
      };
      contextTarget = "exercise";
      continue;
    }

    // - key: value
    if (line.startsWith("- ") && line.includes(":")) {
      const colonIdx = line.indexOf(":", 2);
      const key = line.slice(2, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (contextTarget === "block" && currentBlock) {
        applyBlockAttribute(currentBlock, key, value);
      } else if (contextTarget === "exercise" && currentExercise) {
        applyExerciseAttribute(currentExercise, key, value);
      }
    }
  }

  flushExercise();
  flushBlock();

  if (!planName) {
    throw new Error("Missing plan name (# heading)");
  }
  if (blocks.length === 0) {
    throw new Error("Plan has no blocks (## headings)");
  }
  for (const block of blocks) {
    if (block.exercises.length === 0) {
      throw new Error(`Block "${block.name}" has no exercises`);
    }
  }

  const now = Date.now();
  return {
    id: genId(),
    name: planName,
    blocks,
    createdAt: now,
    updatedAt: now,
  };

  function flushExercise(): void {
    if (currentExercise && currentBlock) {
      if (!currentBlock.exercises) currentBlock.exercises = [];
      currentBlock.exercises.push(currentExercise as Exercise);
    }
    currentExercise = null;
  }

  function flushBlock(): void {
    if (currentBlock && currentBlock.name) {
      const b = currentBlock as Block;
      if (!b.exercises) b.exercises = [];

      // Infer block type from exercise count if not explicit
      if (b.exercises.length === 1 && b.blockType !== "straight") {
        b.blockType = "straight";
      }

      blocks.push(b);
    }
    currentBlock = null;
    contextTarget = null;
  }
}

function parseBlockHeading(text: string): Partial<Block> {
  let blockType: BlockType = "straight";
  let rounds: number = DEFAULTS.rounds;
  let name = text;

  // Extract [type]
  const typeMatch = text.match(/\[(straight|superset|circuit)\]/i);
  if (typeMatch) {
    blockType = typeMatch[1]!.toLowerCase() as BlockType;
    name = name.replace(typeMatch[0], "").trim();
  }

  // Extract xN rounds
  const roundsMatch = name.match(/x(\d+)\s*$/i);
  if (roundsMatch) {
    rounds = parseInt(roundsMatch[1]!, 10);
    name = name.replace(roundsMatch[0], "").trim();
  }

  return {
    id: genId(),
    name: name || "Unnamed Block",
    blockType,
    rounds: Math.max(1, rounds),
    exercises: [],
    restBetweenExercises: DEFAULTS.restBetweenRounds,
    restBetweenRounds: DEFAULTS.restBetweenRounds,
    restAfterBlock: DEFAULTS.restAfterBlock,
  };
}

function applyBlockAttribute(block: Partial<Block>, key: string, value: string): void {
  const seconds = parseSeconds(value);

  switch (key) {
    case "rest":
      block.restBetweenExercises = seconds;
      block.restBetweenRounds = seconds;
      break;
    case "block-rest":
      block.restAfterBlock = seconds;
      break;
    case "exercise-rest":
      block.restBetweenRounds = seconds;
      block.restBetweenExercises = seconds;
      break;
  }
}

function applyExerciseAttribute(exercise: Partial<Exercise>, key: string, value: string): void {
  switch (key) {
    case "reps":
      exercise.prescribedReps = parseRepSpec(value);
      break;
    case "load":
      exercise.prescribedLoad = parseLoadSpec(value);
      break;
    case "notes":
      exercise.notes = value;
      break;
  }
}

function parseSeconds(value: string): number {
  const num = parseInt(value.replace(/s$/i, ""), 10);
  return isNaN(num) ? 0 : Math.max(0, num);
}

export function parseRepSpec(value: string): RepSpec {
  const trimmed = value.trim();

  if (/^amrap$/i.test(trimmed)) {
    return { type: "toFailure" };
  }

  // Timed: 30s, 60s, etc.
  const timedMatch = trimmed.match(/^(\d+)s$/i);
  if (timedMatch) {
    return { type: "timed", seconds: parseInt(timedMatch[1]!, 10) };
  }

  // Range: 8-12
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    return {
      type: "range",
      min: parseInt(rangeMatch[1]!, 10),
      max: parseInt(rangeMatch[2]!, 10),
    };
  }

  // Fixed: 10
  const fixed = parseInt(trimmed, 10);
  if (!isNaN(fixed)) {
    return { type: "fixed", value: fixed };
  }

  return { type: "fixed", value: 10 };
}

export function parseLoadSpec(value: string): LoadSpec {
  const trimmed = value.trim();

  if (/^bw$/i.test(trimmed) || /^bodyweight$/i.test(trimmed)) {
    return { type: "bodyweight" };
  }

  // RPE: RPE 8, RPE 7.5
  const rpeMatch = trimmed.match(/^rpe\s+(\d+(?:\.\d+)?)/i);
  if (rpeMatch) {
    return { type: "rpe", value: parseFloat(rpeMatch[1]!) };
  }

  // Percentage: 75%, 80%
  const pctMatch = trimmed.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) {
    return { type: "percentage", value: parseFloat(pctMatch[1]!) };
  }

  // Weight: 80kg, 35lb
  const weightMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(kg|lb)$/i);
  if (weightMatch) {
    return {
      type: "weight",
      value: parseFloat(weightMatch[1]!),
      unit: weightMatch[2]!.toLowerCase() as "kg" | "lb",
    };
  }

  // No load / unrecognized
  if (trimmed === "" || trimmed === "-") {
    return { type: "none" };
  }

  return { type: "none" };
}
