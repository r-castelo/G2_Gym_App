import type { BlockType, TrainingPlan } from "../../types/contracts";
import { countTotalSets } from "../../domain/workoutEngine";
import { esc, formatLoadInput, formatRepInput } from "../utils";

export interface EditorViewModel {
  plan: TrainingPlan;
  error: string;
  exportMarkdown: string | null;
}

const blockTypes: BlockType[] = ["straight", "superset", "circuit"];
const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const weekdayLabel = (day: (typeof weekdays)[number]): string => `${day.charAt(0).toUpperCase()}${day.slice(1)}`;

export function renderEditorView(model: EditorViewModel): string {
  const { plan, error, exportMarkdown } = model;
  const totalSets = countTotalSets(plan);

  return `<main class="phone-screen editor-screen">
    <header class="screen-header">
      <div class="header-leading">
        <button type="button" class="btn btn-ghost" data-action="open-plans">Back</button>
        <div>
          <p class="screen-kicker">Fitness HUD</p>
          <h1>Plan Editor</h1>
        </div>
      </div>
    </header>

    <section class="panel hierarchy-panel">
      <p class="hierarchy-path">Plan \u203A Block \u203A Set</p>
      <h2>${plan.blocks.length} blocks \u00B7 ${totalSets} sets</h2>
      <p class="muted">Each set has exercise name, reps, weight, and notes.</p>
    </section>

    <section class="panel">
      <h2>Plan Details</h2>
      <div class="field-grid">
        <label class="field field-wide">
          <span>Plan Name</span>
          <input data-model="plan-name" value="${esc(plan.name)}" placeholder="e.g. Push Day A" />
        </label>
        <label class="field">
          <span>Weekday</span>
          <select data-model="plan-weekday" aria-label="Weekday">
            <option value="" ${!plan.weekday ? "selected" : ""}>None</option>
            ${weekdays.map((day) => `<option value="${day}" ${plan.weekday === day ? "selected" : ""}>${weekdayLabel(day)}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="stack">
      ${plan.blocks.map((block, bi) => renderBlock(bi, block)).join("")}
    </section>

    <button type="button" class="btn btn-soft btn-block" data-action="add-block">+ Add Block</button>

    ${error ? `<p class="error-text">${esc(error)}</p>` : ""}
    ${renderExportPanel(exportMarkdown)}

    <section class="panel action-bar">
      <button type="button" class="btn btn-ghost" data-action="export-markdown">Export</button>
      <button type="button" class="btn btn-primary" data-action="save-plan">Save Plan</button>
    </section>
  </main>`;
}

function renderBlock(bi: number, block: TrainingPlan["blocks"][number]): string {
  const title = block.name.trim() || `Block ${bi + 1}`;

  return `<article class="panel block-panel">
    <div class="panel-head">
      <div>
        <p class="block-tag">Block ${bi + 1}</p>
        <h2>${esc(title)}</h2>
      </div>
      <button type="button" class="btn btn-danger btn-small" data-action="remove-block" data-bi="${bi}">Remove</button>
    </div>

    <div class="field-grid">
      <label class="field field-wide">
        <span>Block Name</span>
        <input data-model="block-name" data-bi="${bi}" value="${esc(block.name)}" placeholder="e.g. Chest Strength" />
      </label>
      <label class="field">
        <span>Block Type</span>
        <select data-model="block-type" data-bi="${bi}" aria-label="Block type">
          ${blockTypes.map((type) => `<option value="${type}" ${block.blockType === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>Rounds</span>
        <input type="number" inputmode="numeric" min="1" data-model="block-rounds" data-bi="${bi}" value="${block.rounds}" />
      </label>
      <label class="field">
        <span>Rest Between Rounds (s)</span>
        <input type="number" inputmode="numeric" min="0" data-model="block-rest" data-bi="${bi}" value="${block.restBetweenRounds}" />
      </label>
      <label class="field">
        <span>Rest After Block (s)</span>
        <input type="number" inputmode="numeric" min="0" data-model="block-rest-after" data-bi="${bi}" value="${block.restAfterBlock}" />
      </label>
    </div>

    <div class="sets-head">
      <span class="block-tag">Sets</span>
      <span class="count-pill">${block.exercises.length}</span>
    </div>

    ${block.exercises.length === 0
      ? `<p class="muted">No sets yet. Add your first set.</p>`
      : `<div class="stack">${block.exercises.map((set, ei) => renderSet(bi, ei, set.name, formatRepInput(set.prescribedReps), formatLoadInput(set.prescribedLoad), set.notes ?? "")).join("")}</div>`}

    <button type="button" class="btn btn-soft btn-block" data-action="add-set" data-bi="${bi}">+ Add Set</button>
  </article>`;
}

function renderSet(
  bi: number,
  ei: number,
  exerciseName: string,
  reps: string,
  load: string,
  notes: string,
): string {
  return `<article class="set-panel">
    <div class="set-head">
      <h3>Set ${ei + 1}</h3>
      <button type="button" class="btn btn-danger btn-small" data-action="remove-set" data-bi="${bi}" data-ei="${ei}">Remove</button>
    </div>

    <div class="field-grid">
      <label class="field field-wide">
        <span>Exercise Name</span>
        <input data-model="set-exercise" data-bi="${bi}" data-ei="${ei}" value="${esc(exerciseName)}" placeholder="Bench Press" />
      </label>
      <label class="field">
        <span>Reps</span>
        <input data-model="set-reps" data-bi="${bi}" data-ei="${ei}" value="${esc(reps)}" placeholder="10 / 8-12 / AMRAP / 30s" />
      </label>
      <label class="field">
        <span>Weight</span>
        <input data-model="set-load" data-bi="${bi}" data-ei="${ei}" value="${esc(load)}" placeholder="80kg / BW / RPE 8" />
      </label>
      <label class="field field-wide">
        <span>Notes</span>
        <textarea data-model="set-notes" data-bi="${bi}" data-ei="${ei}" placeholder="Tempo, pause, grip, cue...">${esc(notes)}</textarea>
      </label>
    </div>
  </article>`;
}

function renderExportPanel(exportMarkdown: string | null): string {
  if (!exportMarkdown) return "";

  return `<section class="panel">
    <h2>Markdown Export</h2>
    <label class="field field-wide">
      <span>Select and copy</span>
      <textarea readonly data-model="export-markdown">${esc(exportMarkdown)}</textarea>
    </label>
    <button type="button" class="btn btn-ghost btn-block" data-action="copy-markdown">Copy to Clipboard</button>
  </section>`;
}
