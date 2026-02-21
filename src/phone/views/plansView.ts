import { countTotalSets } from "../../domain/workoutEngine";
import type { TrainingPlan, WeightUnit } from "../../types/contracts";
import { esc } from "../utils";

export interface PlansViewModel {
  plans: TrainingPlan[];
  unit: WeightUnit;
  deletePlanId: string | null;
}

export function renderPlansView(model: PlansViewModel): string {
  const { plans, unit, deletePlanId } = model;

  const listMarkup = plans.length === 0
    ? `<section class="panel empty-state">
        <h2>No plans yet</h2>
        <p>Create or import your first training plan.</p>
      </section>`
    : `<section class="stack">
        ${plans.map((plan) => renderPlanCard(plan, deletePlanId === plan.id)).join("")}
      </section>`;

  return `<main class="phone-screen">
    <header class="screen-header">
      <div>
        <p class="screen-kicker">Phone Console</p>
        <h1>Training Plans</h1>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-ghost" data-action="open-import">Import</button>
        <button type="button" class="btn btn-ghost" data-action="open-history">History</button>
        <button type="button" class="btn btn-primary" data-action="new-plan">New</button>
      </div>
    </header>

    ${listMarkup}

    <section class="panel settings-panel">
      <label class="field field-inline">
        <span>Weight Unit</span>
        <select data-model="unit-preference" aria-label="Weight unit">
          <option value="kg" ${unit === "kg" ? "selected" : ""}>kg</option>
          <option value="lb" ${unit === "lb" ? "selected" : ""}>lb</option>
        </select>
      </label>
    </section>
  </main>`;
}

function renderPlanCard(plan: TrainingPlan, deleting: boolean): string {
  const setCount = countTotalSets(plan);
  const blockCount = plan.blocks.length;
  const weekday = plan.weekday ? plan.weekday.toUpperCase() : "";

  return `<article class="panel plan-card ${deleting ? "plan-delete-pending" : ""}">
    <div class="plan-body">
      <h2>${esc(plan.name)}</h2>
      <p>${blockCount} blocks \u00B7 ${setCount} sets${weekday ? ` \u00B7 ${weekday}` : ""}</p>
    </div>
    <div class="plan-actions">
      <button type="button" class="btn btn-primary btn-small" data-action="start-plan" data-plan-id="${plan.id}">Start</button>
      <button type="button" class="btn btn-soft btn-small" data-action="edit-plan" data-plan-id="${plan.id}">Edit</button>
      <button type="button" class="btn btn-danger btn-small" data-action="ask-delete-plan" data-plan-id="${plan.id}">Delete</button>
    </div>
  </article>`;
}
