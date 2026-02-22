import type { WorkoutLog } from "../../types/contracts";
import {
  badgeClass,
  buttonClass,
  cardClass,
  cardContentClass,
  textClass,
} from "../designSystem";
import { esc } from "../utils";

export interface HistoryViewModel {
  logs: WorkoutLog[];
}

export function renderHistoryView(model: HistoryViewModel): string {
  const { logs } = model;
  const clearButton = logs.length > 0
    ? `<button type="button" class="${buttonClass("negative", "sm")}" data-action="clear-history">Clear History</button>`
    : "";

  return `<main class="phone-screen history-screen">
    <header class="screen-header">
      <div class="header-leading">
        <button type="button" class="${buttonClass("default", "sm")}" data-action="open-plans">Back</button>
        <div>
          <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
          <h1 class="${textClass("title-lg")}">Workout Logs</h1>
        </div>
      </div>
      ${clearButton ? `<div class="header-actions">${clearButton}</div>` : ""}
    </header>

    ${logs.length === 0
      ? `<section class="${cardClass("empty-state")}">
          <div class="${cardContentClass()}">
            <h2 class="${textClass("title-1")}">No workouts logged yet</h2>
            <p class="${textClass("body-2", "muted")}">Finished and abandoned sessions will appear here.</p>
          </div>
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

  return `<article class="${cardClass("history-card")}">
    <div class="${cardContentClass()}">
    <div class="history-top">
      <h2 class="${textClass("title-2")}">${esc(log.planName)}</h2>
      <span class="${badgeClass(`status-badge ${statusClass}`)}">${statusLabel}</span>
    </div>
    <p class="${textClass("body-2", "muted")}">${date.toLocaleDateString()} \u00B7 ${mins}:${secs.toString().padStart(2, "0")}</p>
    <p class="${textClass("body-2", "muted")}">${log.totalSetsCompleted}/${log.totalSetsPlanned} sets</p>
    </div>
  </article>`;
}
