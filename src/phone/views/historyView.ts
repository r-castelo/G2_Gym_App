import type { WorkoutLog } from "../../types/contracts";
import { esc } from "../utils";

export interface HistoryViewModel {
  logs: WorkoutLog[];
}

export function renderHistoryView(model: HistoryViewModel): string {
  const { logs } = model;
  const clearButton = logs.length > 0
    ? `<button type="button" class="btn btn-danger btn-small" data-action="clear-history">Clear History</button>`
    : "";

  return `<main class="phone-screen history-screen">
    <header class="screen-header">
      <div class="header-leading">
        <button type="button" class="btn btn-ghost" data-action="open-plans">Back</button>
        <div>
          <p class="screen-kicker">Fitness HUD</p>
          <h1>Workout Logs</h1>
        </div>
      </div>
      ${clearButton ? `<div class="header-actions">${clearButton}</div>` : ""}
    </header>

    ${logs.length === 0
      ? `<section class="panel empty-state">
          <h2>No workouts logged yet</h2>
          <p>Finished and abandoned sessions will appear here.</p>
        </section>`
      : `<section class="stack">
          ${logs.map((log) => renderLogItem(log)).join("")}
        </section>`}
  </main>`;
}

function renderLogItem(log: WorkoutLog): string {
  const date = new Date(log.startedAt);
  const mins = Math.floor(log.durationSeconds / 60);
  const secs = log.durationSeconds % 60;
  const statusClass = log.completionStatus === "completed" ? "log-completed" : "log-abandoned";
  const statusLabel = log.completionStatus === "completed" ? "Completed" : "Abandoned";

  return `<article class="panel history-card">
    <div class="history-top">
      <h2>${esc(log.planName)}</h2>
      <span class="status-pill ${statusClass}">${statusLabel}</span>
    </div>
    <p>${date.toLocaleDateString()} \u00B7 ${mins}:${secs.toString().padStart(2, "0")}</p>
    <p class="muted">${log.totalSetsCompleted}/${log.totalSetsPlanned} sets</p>
  </article>`;
}
