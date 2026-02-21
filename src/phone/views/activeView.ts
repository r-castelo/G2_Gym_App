import { formatLoad, formatReps } from "../../domain/displayFormatter";
import { countTotalSets, flatSetIndex, getExerciseAtCursor, nextStep } from "../../domain/workoutEngine";
import type { WorkoutSession } from "../../types/contracts";
import { esc } from "../utils";

export interface ActiveViewModel {
  session: WorkoutSession;
}

export function renderActiveView(model: ActiveViewModel): string {
  const session = model.session;
  const info = getExerciseAtCursor(session.cursor, session.plan);
  const totalSets = countTotalSets(session.plan);
  const currentSet = flatSetIndex(session.cursor, session.plan);
  const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const completedSets = session.performedSets.length;
  const progressPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  let statusText = "In Progress";
  if (session.paused) statusText = "Paused";
  if (session.cursor.phase === "rest" || session.cursor.phase === "blockRest") statusText = "Resting";

  const blockLabel = info
    ? `Block ${session.cursor.blockIndex + 1} out of ${session.plan.blocks.length} \u00B7 ${info.blockName || `Block ${session.cursor.blockIndex + 1}`}`
    : `Block ${session.cursor.blockIndex + 1} out of ${session.plan.blocks.length}`;

  const nowLine = info
    ? `NOW: ${info.exercise.name.toUpperCase()} ${formatReps(info.exercise.prescribedReps).toUpperCase()} \u00B7 Set ${session.cursor.roundNumber}/${info.block.rounds}`
    : "NOW: Workout state unavailable";

  const nextLine = renderNextLine(session);

  return `<main class="phone-screen">
    <header class="screen-header">
      <div>
        <p class="screen-kicker">Active</p>
        <h1>${esc(session.planName)}</h1>
      </div>
      <div class="status-pill status-connected">${esc(statusText.toUpperCase())}</div>
    </header>

    <section class="panel active-panel">
      <p class="active-block-title">${esc(blockLabel)}</p>
      <div class="active-divider" aria-hidden="true"></div>
      <p class="active-now-line">${esc(nowLine)}</p>
      <div class="active-divider" aria-hidden="true"></div>
      <p class="active-next-line">${esc(nextLine)}</p>
    </section>

    <section class="panel progress-panel">
      <h2>${esc(session.planName)} \u00B7 ${progressPct}% Completed</h2>
      <p class="muted">Set ${Math.min(currentSet, totalSets)}/${totalSets} \u00B7 ${mins}:${secs.toString().padStart(2, "0")}</p>
    </section>

    <section class="panel action-bar">
      <button type="button" class="btn btn-danger btn-block" data-action="abandon-workout">Abandon Workout</button>
    </section>
  </main>`;
}

function renderNextLine(session: WorkoutSession): string {
  const result = nextStep(session.cursor, session.plan);
  if (result.done) return "Next: Workout Complete";

  const nextInfo = getExerciseAtCursor(result.cursor, session.plan);
  if (!nextInfo) return "Next: Workout Complete";

  const load = formatLoad(nextInfo.exercise.prescribedLoad);
  const reps = formatReps(nextInfo.exercise.prescribedReps);
  const details = [reps, load].filter(Boolean).join(" ");
  return `Next: ${nextInfo.exercise.name}${details ? ` ${details}` : ""} \u00B7 Set ${result.cursor.roundNumber}/${nextInfo.block.rounds}`;
}
