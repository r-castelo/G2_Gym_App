import type { BlockType, TrainingPlan } from "../../types/contracts";
import { countTotalSets } from "../../domain/workoutEngine";
import {
  badgeClass,
  buttonClass,
  cardClass,
  cardContentClass,
  cardFooterClass,
  cardHeaderClass,
  inputClass,
  selectClass,
  textClass,
  textareaClass,
} from "../designSystem";
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
        <button type="button" class="${buttonClass("default", "sm")}" data-action="open-plans">Back</button>
        <div>
          <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
          <h1 class="${textClass("title-lg")}">Plan Editor</h1>
        </div>
      </div>
    </header>

    <section class="${cardClass("hierarchy-panel")}">
      <div class="${cardContentClass()}">
        <p class="${textClass("detail", "hierarchy-path muted")}">Plan \u203A Block \u203A Set</p>
        <h2 class="${textClass("title-1")}">${plan.blocks.length} blocks \u00B7 ${totalSets} sets</h2>
        <p class="${textClass("body-2", "muted")}">Each set has exercise name, reps, weight, and notes.</p>
      </div>
    </section>

    <section class="${cardClass()}">
      <div class="${cardHeaderClass()}">
        <h2 class="${textClass("title-2")}">Plan Details</h2>
      </div>
      <div class="${cardContentClass()}">
        <div class="field-grid">
          <label class="field field-wide">
            <span class="${textClass("detail", "muted")}">Plan Name</span>
            <input class="${inputClass()}" data-model="plan-name" value="${esc(plan.name)}" placeholder="e.g. Push Day A" />
          </label>
          <label class="field">
            <span class="${textClass("detail", "muted")}">Weekday</span>
            <select class="${selectClass()}" data-model="plan-weekday" aria-label="Weekday">
              <option value="" ${!plan.weekday ? "selected" : ""}>None</option>
              ${weekdays.map((day) => `<option value="${day}" ${plan.weekday === day ? "selected" : ""}>${weekdayLabel(day)}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
    </section>

    <section class="stack">
      ${plan.blocks.map((block, bi) => renderBlock(bi, block)).join("")}
    </section>

    <button type="button" class="${buttonClass("accent", "md", "btn-block")}" data-action="add-block">+ Add Block</button>

    ${error ? `<p class="${textClass("body-2", "error-text")}">${esc(error)}</p>` : ""}
    ${renderExportPanel(exportMarkdown)}

    <section class="${cardClass("action-bar")}">
      <div class="${cardContentClass("action-bar-content")}">
        <button type="button" class="${buttonClass("default", "sm")}" data-action="export-markdown">Export Markdown</button>
      </div>
    </section>

    <div class="editor-floating-actions">
      <button type="button" class="${buttonClass("primary", "md", "floating-save")}" data-action="save-plan">Save Plan</button>
    </div>
  </main>`;
}

function renderBlock(bi: number, block: TrainingPlan["blocks"][number]): string {
  const title = block.name.trim() || `Block ${bi + 1}`;

  return `<article class="${cardClass("block-panel")}">
    <div class="${cardHeaderClass("panel-head")}">
      <div class="panel-head-main">
        <p class="${textClass("detail", "block-tag muted")}">Block ${bi + 1}</p>
        <h2 class="${textClass("title-2")}">${esc(title)}</h2>
      </div>
      <button type="button" class="${buttonClass("negative", "sm")}" data-action="remove-block" data-bi="${bi}">Remove</button>
    </div>

    <div class="${cardContentClass()}">
      <div class="field-grid">
        <label class="field field-wide">
          <span class="${textClass("detail", "muted")}">Block Name</span>
          <input class="${inputClass()}" data-model="block-name" data-bi="${bi}" value="${esc(block.name)}" placeholder="e.g. Chest Strength" />
        </label>
        <label class="field">
          <span class="${textClass("detail", "muted")}">Block Type</span>
          <select class="${selectClass()}" data-model="block-type" data-bi="${bi}" aria-label="Block type">
            ${blockTypes.map((type) => `<option value="${type}" ${block.blockType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span class="${textClass("detail", "muted")}">Rounds</span>
          <input class="${inputClass()}" type="number" inputmode="numeric" min="1" data-model="block-rounds" data-bi="${bi}" value="${block.rounds}" />
        </label>
        <label class="field">
          <span class="${textClass("detail", "muted")}">Rest Between Sets/Rounds (s)</span>
          <input
            class="${inputClass()}"
            type="number"
            inputmode="numeric"
            min="0"
            data-model="block-rest"
            data-bi="${bi}"
            value="${block.restBetweenRounds > 0 ? block.restBetweenRounds : block.restBetweenExercises}"
          />
        </label>
        <label class="field">
          <span class="${textClass("detail", "muted")}">Rest After Block (s)</span>
          <input class="${inputClass()}" type="number" inputmode="numeric" min="0" data-model="block-rest-after" data-bi="${bi}" value="${block.restAfterBlock}" />
        </label>
      </div>
    </div>

    <div class="${cardFooterClass("sets-section")}">
      <div class="sets-head">
        <span class="${textClass("detail", "block-tag muted")}">Sets</span>
        <span class="${badgeClass("count-pill")}">${block.exercises.length}</span>
      </div>

      ${block.exercises.length === 0
        ? `<p class="${textClass("body-2", "muted")}">No sets yet. Add your first set.</p>`
        : `<div class="stack">${block.exercises.map((set, ei) => renderSet(bi, ei, set.name, formatRepInput(set.prescribedReps), formatLoadInput(set.prescribedLoad), set.notes ?? "")).join("")}</div>`}

      <button type="button" class="${buttonClass("accent", "sm", "btn-block")}" data-action="add-set" data-bi="${bi}">+ Add Set</button>
    </div>
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
  return `<article class="${cardClass("set-panel")}">
    <div class="set-head">
      <h3 class="${textClass("title-2")}">Set ${ei + 1}</h3>
      <button type="button" class="${buttonClass("negative", "sm")}" data-action="remove-set" data-bi="${bi}" data-ei="${ei}">Remove</button>
    </div>

    <div class="field-grid">
      <label class="field field-wide">
        <span class="${textClass("detail", "muted")}">Exercise Name</span>
        <input class="${inputClass()}" data-model="set-exercise" data-bi="${bi}" data-ei="${ei}" value="${esc(exerciseName)}" placeholder="Bench Press" />
      </label>
      <label class="field">
        <span class="${textClass("detail", "muted")}">Reps</span>
        <input class="${inputClass()}" data-model="set-reps" data-bi="${bi}" data-ei="${ei}" value="${esc(reps)}" placeholder="10 / 8-12 / AMRAP / 30s" />
      </label>
      <label class="field">
        <span class="${textClass("detail", "muted")}">Weight</span>
        <input class="${inputClass()}" data-model="set-load" data-bi="${bi}" data-ei="${ei}" value="${esc(load)}" placeholder="80kg / BW / RPE 8" />
      </label>
      <label class="field field-wide">
        <span class="${textClass("detail", "muted")}">Notes</span>
        <textarea class="${textareaClass()}" data-model="set-notes" data-bi="${bi}" data-ei="${ei}" placeholder="Tempo, pause, grip, cue...">${esc(notes)}</textarea>
      </label>
    </div>
  </article>`;
}

function renderExportPanel(exportMarkdown: string | null): string {
  if (!exportMarkdown) return "";

  return `<section class="${cardClass()}">
    <div class="${cardHeaderClass()}">
      <h2 class="${textClass("title-2")}">Markdown Export</h2>
    </div>
    <div class="${cardContentClass()}">
    <label class="field field-wide">
      <span class="${textClass("detail", "muted")}">Select and copy</span>
      <textarea class="${textareaClass("export-textarea")}" readonly data-model="export-markdown">${esc(exportMarkdown)}</textarea>
    </label>
    </div>
    <div class="${cardFooterClass()}">
      <button type="button" class="${buttonClass("default", "sm", "btn-block")}" data-action="copy-markdown">Copy to Clipboard</button>
    </div>
  </section>`;
}
