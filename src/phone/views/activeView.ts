import { formatLoad, formatReps } from "../../domain/displayFormatter";
import { blockSetProgress, countTotalSets, flatSetIndex, getExerciseAtCursor, nextStep } from "../../domain/workoutEngine";
import type { WorkoutSession } from "../../types/contracts";
import {
  badgeClass,
  buttonClass,
  cardClass,
  cardContentClass,
  cardHeaderClass,
  textClass,
} from "../designSystem";
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
  const statusClass = session.paused
    ? "status-badge-paused"
    : session.cursor.phase === "rest" || session.cursor.phase === "blockRest"
      ? "status-badge-resting"
      : "status-badge-connected";

  const blockLabel = info
    ? `Block ${session.cursor.blockIndex + 1} out of ${session.plan.blocks.length} \u00B7 ${info.blockName || `Block ${session.cursor.blockIndex + 1}`}`
    : `Block ${session.cursor.blockIndex + 1} out of ${session.plan.blocks.length}`;
  const currentSetInBlock = blockSetProgress(session.cursor, session.plan);

  const nowLine = info
    ? `NOW: ${info.exercise.name.toUpperCase()} ${formatReps(info.exercise.prescribedReps).toUpperCase()} \u00B7 Set ${currentSetInBlock.current}/${currentSetInBlock.total}`
    : "NOW: Workout state unavailable";

  const nextLine = renderNextLine(session);

  return `<main class="phone-screen">
    <header class="screen-header">
      <div>
        <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
        <h1 class="${textClass("title-lg")}">${esc(session.planName)}</h1>
      </div>
      <div class="${badgeClass(`status-badge ${statusClass}`)}">${esc(statusText)}</div>
    </header>

    <section class="${cardClass("active-panel")}">
      <div class="${cardContentClass()}">
      <p class="${textClass("detail", "active-block-title muted")}">${esc(blockLabel)}</p>
      <div class="active-divider" aria-hidden="true"></div>
      <p class="${textClass("title-1", "active-now-line")}">${esc(nowLine)}</p>
      <div class="active-divider" aria-hidden="true"></div>
      <p class="${textClass("body-2", "active-next-line muted")}">${esc(nextLine)}</p>
      </div>
    </section>

    <section class="${cardClass("progress-panel")}">
      <div class="${cardHeaderClass()}">
        <h2 class="${textClass("title-2")}">${esc(session.planName)} \u00B7 ${progressPct}% Completed</h2>
      </div>
      <div class="${cardContentClass()}">
        <p class="${textClass("body-2", "muted")}">Set ${Math.min(currentSet, totalSets)}/${totalSets} \u00B7 ${mins}:${secs.toString().padStart(2, "0")}</p>
      </div>
    </section>

    <section class="${cardClass("action-bar")}">
      <div class="${cardContentClass()}">
        <button type="button" class="${buttonClass("negative", "md", "btn-block")}" data-action="abandon-workout">Abandon Workout</button>
      </div>
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
  const nextSetInBlock = blockSetProgress(result.cursor, session.plan);
  return `Next: ${nextInfo.exercise.name}${details ? ` ${details}` : ""} \u00B7 Set ${nextSetInBlock.current}/${nextSetInBlock.total}`;
}
