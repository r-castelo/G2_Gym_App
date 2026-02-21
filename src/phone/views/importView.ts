import { countTotalSets } from "../../domain/workoutEngine";
import { formatLoad, formatReps } from "../../domain/displayFormatter";
import type { TrainingPlan } from "../../types/contracts";
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
        <button type="button" class="btn btn-ghost" data-action="open-plans">Back</button>
        <div>
          <p class="screen-kicker">Import</p>
          <h1>Markdown Plan</h1>
        </div>
      </div>
    </header>

    <section class="panel">
      <label class="field field-wide">
        <span>Paste workout markdown</span>
        <textarea data-model="import-draft" placeholder="# Plan Name\n\n## Block [superset] x3\n- rest: 60s\n\n### Exercise\n- reps: 10\n- load: 80kg">${esc(model.draft)}</textarea>
      </label>
    </section>

    <section class="panel">
      <label class="field field-wide" for="import-file">
        <span>Or upload a .md file</span>
        <input type="file" id="import-file" accept=".md,.txt" />
      </label>
    </section>

    <button type="button" class="btn btn-primary btn-block" data-action="parse-import">Preview Import</button>
    ${model.error ? `<p class="error-text">${esc(model.error)}</p>` : ""}
    ${previewMarkup}
  </main>`;
}

function renderPreview(plan: TrainingPlan): string {
  return `<section class="panel">
    <p class="screen-kicker">Preview</p>
    <h2>${esc(plan.name)}</h2>
    <p class="muted">${plan.blocks.length} blocks \u00B7 ${countTotalSets(plan)} total sets</p>
    <div class="stack preview-stack">
      ${plan.blocks.map((block) => renderBlockPreview(block)).join("")}
    </div>
    <button type="button" class="btn btn-primary btn-block" data-action="confirm-import">Confirm Import</button>
  </section>`;
}

function renderBlockPreview(block: TrainingPlan["blocks"][number]): string {
  return `<article class="preview-block">
    <h3>${esc(block.name)} <span>[${block.blockType}] x${block.rounds}</span></h3>
    <ul>
      ${block.exercises.map((exercise) => {
        const load = formatLoad(exercise.prescribedLoad);
        return `<li>${esc(exercise.name)} \u2014 ${formatReps(exercise.prescribedReps)}${load ? ` @ ${load}` : ""}</li>`;
      }).join("")}
    </ul>
  </article>`;
}
