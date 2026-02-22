import { countTotalExercises, countTotalSets } from "../../domain/workoutEngine";
import type { TrainingPlan, WeightUnit } from "../../types/contracts";
import {
  badgeClass,
  buttonClass,
  cardClass,
  cardContentClass,
  cardFooterClass,
  selectClass,
  textClass,
} from "../designSystem";
import { esc } from "../utils";

function formatWeekdayLabel(day: TrainingPlan["weekday"]): string {
  if (!day) return "";
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
}

export interface PlansViewModel {
  plans: TrainingPlan[];
  unit: WeightUnit;
  deletePlanId: string | null;
}

export function renderPlansView(model: PlansViewModel): string {
  const { plans, unit, deletePlanId } = model;

  const listMarkup = plans.length === 0
    ? `<section class="${cardClass("empty-state")}">
        <div class="${cardContentClass()}">
          <h2 class="${textClass("title-1")}">No plans yet</h2>
          <p class="${textClass("body-2", "muted")}">Create or import your first training plan.</p>
        </div>
      </section>`
    : `<section class="stack">
        ${plans.map((plan) => renderPlanCard(plan, deletePlanId === plan.id)).join("")}
      </section>`;

  return `<main class="phone-screen plans-screen">
    <header class="screen-header">
      <div>
        <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
        <h1 class="${textClass("title-lg")}">Training Plans</h1>
      </div>
      <div class="header-actions">
        <button type="button" class="${buttonClass("default", "sm")}" data-action="open-import">Import</button>
        <button type="button" class="${buttonClass("default", "sm")}" data-action="open-history">History</button>
        <button type="button" class="${buttonClass("primary", "sm")}" data-action="new-plan">New</button>
      </div>
    </header>

    ${listMarkup}

    <section class="${cardClass("settings-panel")}">
      <div class="${cardContentClass()}">
      <label class="field field-inline">
        <span class="${textClass("detail", "muted")}">Weight Unit</span>
        <select data-model="unit-preference" aria-label="Weight unit" class="${selectClass()}">
          <option value="kg" ${unit === "kg" ? "selected" : ""}>kg</option>
          <option value="lb" ${unit === "lb" ? "selected" : ""}>lb</option>
        </select>
      </label>
      </div>
    </section>

    <footer class="credits-footer">Created by Renato Castelo Branco</footer>
  </main>`;
}

function renderPlanCard(plan: TrainingPlan, deleting: boolean): string {
  const setCount = countTotalSets(plan);
  const exerciseCount = countTotalExercises(plan);
  const blockCount = plan.blocks.length;
  const weekday = formatWeekdayLabel(plan.weekday);
  const totalRounds = plan.blocks.reduce((sum, block) => sum + block.rounds, 0);

  const flowPreview = plan.blocks.slice(0, 2).map((block, index) => {
    const name = block.name.trim() || `Block ${index + 1}`;
    return `${esc(name)} (${block.blockType} x${block.rounds})`;
  }).join(" \u2192 ");
  const flowSuffix = plan.blocks.length > 2 ? ` \u2192 +${plan.blocks.length - 2} more` : "";

  return `<article class="${cardClass(`plan-card ${deleting ? "plan-delete-pending" : ""}`)}">
    <div class="${cardContentClass("plan-body")}">
      <h2 class="${textClass("title-1")}">${esc(plan.name)}</h2>
      <div class="plan-meta-row">
        <span class="${badgeClass("plan-stat-chip")}">${blockCount} blocks</span>
        <span class="${badgeClass("plan-stat-chip")}">${setCount} sets</span>
        <span class="${badgeClass("plan-stat-chip")}">${exerciseCount} exercises</span>
        <span class="${badgeClass("plan-stat-chip")}">${totalRounds} rounds</span>
        <span class="${badgeClass("plan-stat-chip")}">${weekday ? `Day ${weekday}` : "No weekday"}</span>
      </div>
      <p class="${textClass("body-2", "plan-flow-line muted")}">${flowPreview}${flowSuffix}</p>
    </div>
    <div class="${cardFooterClass("plan-actions")}">
      <button type="button" class="${buttonClass("primary", "sm")}" data-action="start-plan" data-plan-id="${plan.id}">Start</button>
      <button type="button" class="${buttonClass("default", "sm")}" data-action="edit-plan" data-plan-id="${plan.id}">Edit</button>
      <button type="button" class="${buttonClass("negative", "sm")}" data-action="ask-delete-plan" data-plan-id="${plan.id}">Delete</button>
    </div>
  </article>`;
}
