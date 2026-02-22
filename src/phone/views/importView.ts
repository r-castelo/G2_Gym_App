import { countTotalSets } from "../../domain/workoutEngine";
import { formatLoad, formatReps } from "../../domain/displayFormatter";
import type { TrainingPlan } from "../../types/contracts";
import {
  buttonClass,
  cardClass,
  cardContentClass,
  cardHeaderClass,
  inputClass,
  textClass,
  textareaClass,
} from "../designSystem";
import { esc } from "../utils";

export interface ImportViewModel {
  draft: string;
  error: string;
  previewPlan: TrainingPlan | null;
}

export function renderImportView(model: ImportViewModel): string {
  const previewMarkup = model.previewPlan ? renderPreview(model.previewPlan) : "";

  return `<main class="phone-screen">
    <header class="screen-header">
      <div class="header-leading">
        <button type="button" class="${buttonClass("default", "sm")}" data-action="open-plans">Back</button>
        <div>
          <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
          <h1 class="${textClass("title-lg")}">Markdown Plan</h1>
        </div>
      </div>
    </header>

    <section class="${cardClass()}">
      <div class="${cardHeaderClass()}">
        <h2 class="${textClass("title-2")}">Paste Markdown</h2>
      </div>
      <div class="${cardContentClass()}">
      <label class="field field-wide">
        <span class="${textClass("detail", "muted")}">Workout Definition</span>
        <textarea class="${textareaClass()}" data-model="import-draft" placeholder="# Plan Name\n\n## Block [superset] x3\n- rest: 60s\n\n### Exercise\n- reps: 10\n- load: 80kg">${esc(model.draft)}</textarea>
      </label>
      </div>
    </section>

    <section class="${cardClass()}">
      <div class="${cardHeaderClass()}">
        <h2 class="${textClass("title-2")}">Upload File</h2>
      </div>
      <div class="${cardContentClass()}">
      <label class="field field-wide" for="import-file">
        <span class="${textClass("detail", "muted")}">.md or .txt</span>
        <input class="${inputClass()}" type="file" id="import-file" accept=".md,.txt" />
      </label>
      </div>
    </section>

    <button type="button" class="${buttonClass("primary", "md", "btn-block")}" data-action="parse-import">Preview Import</button>
    ${model.error ? `<p class="${textClass("body-2", "error-text")}">${esc(model.error)}</p>` : ""}
    ${previewMarkup}
  </main>`;
}

function renderPreview(plan: TrainingPlan): string {
  return `<section class="${cardClass()}">
    <div class="${cardHeaderClass()}">
      <p class="${textClass("detail", "screen-kicker")}">Preview</p>
      <h2 class="${textClass("title-1")}">${esc(plan.name)}</h2>
      <p class="${textClass("body-2", "muted")}">${plan.blocks.length} blocks \u00B7 ${countTotalSets(plan)} total sets</p>
    </div>
    <div class="${cardContentClass()}">
      <div class="stack preview-stack">
        ${plan.blocks.map((block) => renderBlockPreview(block)).join("")}
      </div>
    </div>
    <div class="${cardContentClass()}">
      <button type="button" class="${buttonClass("primary", "md", "btn-block")}" data-action="confirm-import">Confirm Import</button>
    </div>
  </section>`;
}

function renderBlockPreview(block: TrainingPlan["blocks"][number]): string {
  return `<article class="${cardClass("preview-block")}">
    <div class="${cardContentClass()}">
    <h3 class="${textClass("title-2")}">${esc(block.name)} <span class="${textClass("detail", "muted")}">[${block.blockType}] x${block.rounds}</span></h3>
    <ul>
      ${block.exercises.map((exercise) => {
        const load = formatLoad(exercise.prescribedLoad);
        return `<li>${esc(exercise.name)} \u2014 ${formatReps(exercise.prescribedReps)}${load ? ` @ ${load}` : ""}</li>`;
      }).join("")}
    </ul>
    </div>
  </article>`;
}
