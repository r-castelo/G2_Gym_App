import { DEFAULTS } from "../config/constants";
import { parseWorkoutMarkdown } from "../domain/markdownImporter";
import { exportToMarkdown } from "../domain/markdownExporter";
import { formatReps, formatLoad } from "../domain/displayFormatter";
import { countTotalSets, flatSetIndex, getExerciseAtCursor } from "../domain/workoutEngine";
import type {
  Block,
  BlockType,
  Exercise,
  LoadSpec,
  RepSpec,
  StorageAdapter,
  TrainingPlan,
  WeightUnit,
  WorkoutSession,
} from "../types/contracts";

export interface PhoneUIOptions {
  storage: StorageAdapter;
  onStartWorkout: (planId: string) => void;
  onAbandonWorkout: () => void;
}

type PhoneView = "plans" | "editor" | "import" | "active" | "history";

let idCounter = 0;
function genId(): string {
  return `${Date.now()}-${++idCounter}`;
}

export class PhoneUI {
  private readonly storage: StorageAdapter;
  private readonly onStartWorkout: (planId: string) => void;
  private readonly onAbandonWorkout: () => void;

  private currentView: PhoneView = "plans";
  private editingPlan: TrainingPlan | null = null;

  // DOM containers
  private readonly appEl: HTMLElement;
  private readonly statusEl: HTMLElement;

  constructor(options: PhoneUIOptions) {
    this.storage = options.storage;
    this.onStartWorkout = options.onStartWorkout;
    this.onAbandonWorkout = options.onAbandonWorkout;

    this.appEl = document.getElementById("app-content")!;
    this.statusEl = document.getElementById("status-screen")!;
  }

  show(): void {
    this.statusEl.classList.add("hidden");
    this.appEl.classList.remove("hidden");
    this.renderPlanList();
  }

  /** Called by controller when session state changes. */
  onSessionUpdate(session: WorkoutSession | null): void {
    if (session && this.currentView !== "active") {
      this.renderActiveWorkout(session);
    } else if (session && this.currentView === "active") {
      this.updateActiveWorkout(session);
    } else if (!session && this.currentView === "active") {
      this.renderPlanList();
    }
  }

  // --- Plan List ---

  private renderPlanList(): void {
    this.currentView = "plans";
    const plans = this.storage.loadPlans();

    let html = `<div class="view-header">
      <h2>Training Plans</h2>
      <div class="header-actions">
        <button class="btn-icon" id="btn-import">Import</button>
        <button class="btn-icon" id="btn-history">History</button>
        <button class="btn-primary" id="btn-new-plan">+ New Plan</button>
      </div>
    </div>`;

    if (plans.length === 0) {
      html += `<div class="empty-state">No plans yet. Create or import a plan.</div>`;
    } else {
      html += `<div class="plan-list">`;
      for (const plan of plans) {
        const setCount = countTotalSets(plan);
        const blockCount = plan.blocks.length;
        const weekday = plan.weekday ? plan.weekday.toUpperCase() : "";
        html += `<div class="plan-card" data-plan-id="${plan.id}">
          <div class="plan-card-info">
            <div class="plan-card-name">${esc(plan.name)}</div>
            <div class="plan-card-meta">${blockCount} blocks, ${setCount} sets${weekday ? ` \u00B7 ${weekday}` : ""}</div>
          </div>
          <div class="plan-card-actions">
            <button class="btn-start" data-plan-id="${plan.id}">Start</button>
            <button class="btn-edit" data-plan-id="${plan.id}">Edit</button>
            <button class="btn-delete" data-plan-id="${plan.id}">Del</button>
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // Unit preference
    const unit = this.storage.loadUnitPreference();
    html += `<div class="settings-row">
      <label>Weight unit:</label>
      <select id="unit-pref">
        <option value="kg"${unit === "kg" ? " selected" : ""}>kg</option>
        <option value="lb"${unit === "lb" ? " selected" : ""}>lb</option>
      </select>
    </div>`;

    this.appEl.innerHTML = html;
    this.bindPlanListEvents();
  }

  private bindPlanListEvents(): void {
    document.getElementById("btn-new-plan")?.addEventListener("click", () => {
      this.renderEditor(null);
    });
    document.getElementById("btn-import")?.addEventListener("click", () => {
      this.renderImport();
    });
    document.getElementById("btn-history")?.addEventListener("click", () => {
      this.renderHistory();
    });
    document.getElementById("unit-pref")?.addEventListener("change", (e) => {
      const val = (e.target as HTMLSelectElement).value as WeightUnit;
      this.storage.saveUnitPreference(val);
    });

    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-start")) {
      btn.addEventListener("click", () => {
        const id = btn.dataset["planId"];
        if (id) this.onStartWorkout(id);
      });
    }
    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-edit")) {
      btn.addEventListener("click", () => {
        const id = btn.dataset["planId"];
        if (!id) return;
        const plan = this.storage.loadPlans().find((p) => p.id === id);
        if (plan) this.renderEditor(plan);
      });
    }
    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-delete")) {
      btn.addEventListener("click", () => {
        const id = btn.dataset["planId"];
        if (!id) return;
        const card = btn.closest(".plan-card") as HTMLElement | null;
        if (!card) return;
        // Toggle inline confirm row
        let confirmRow = card.querySelector<HTMLElement>(".delete-confirm");
        if (confirmRow) {
          confirmRow.classList.toggle("hidden");
          return;
        }
        confirmRow = document.createElement("div");
        confirmRow.className = "delete-confirm confirm-row";
        confirmRow.innerHTML = `<span>Delete this plan?</span>
          <button class="btn-danger btn-delete-yes">Yes</button>
          <button class="btn-secondary btn-delete-no">Cancel</button>`;
        card.appendChild(confirmRow);

        confirmRow.querySelector(".btn-delete-yes")?.addEventListener("click", () => {
          this.storage.deletePlan(id);
          this.renderPlanList();
        });
        confirmRow.querySelector(".btn-delete-no")?.addEventListener("click", () => {
          confirmRow?.classList.add("hidden");
        });
      });
    }
  }

  // --- Plan Editor ---

  private renderEditor(plan: TrainingPlan | null): void {
    this.currentView = "editor";
    const isNew = !plan;

    this.editingPlan = plan ? structuredClone(plan) : {
      id: genId(),
      name: "",
      weekday: null,
      blocks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.renderEditorContent();
  }

  private renderEditorContent(): void {
    const plan = this.editingPlan;
    if (!plan) return;

    let html = `<div class="view-header">
      <button class="btn-back" id="btn-back">Back</button>
      <h2>${plan.name || "New Plan"}</h2>
      <button class="btn-primary" id="btn-save">Save</button>
    </div>`;

    html += `<div class="form-section">
      <label>Plan Name</label>
      <input type="text" id="plan-name" value="${esc(plan.name)}" placeholder="e.g. Push Day A" />
    </div>`;

    html += `<div class="form-section">
      <label>Weekday (optional)</label>
      <select id="plan-weekday">
        <option value="">None</option>
        ${["mon","tue","wed","thu","fri","sat","sun"].map(d =>
          `<option value="${d}"${plan.weekday === d ? " selected" : ""}>${d.toUpperCase()}</option>`
        ).join("")}
      </select>
    </div>`;

    // Blocks
    for (let bi = 0; bi < plan.blocks.length; bi++) {
      const block = plan.blocks[bi]!;
      html += `<div class="block-card" data-block-idx="${bi}">
        <div class="block-header">
          <input type="text" class="block-name" data-bi="${bi}" value="${esc(block.name)}" placeholder="Block name" />
          <select class="block-type" data-bi="${bi}">
            ${(["straight","superset","circuit"] as BlockType[]).map(t =>
              `<option value="${t}"${block.blockType === t ? " selected" : ""}>${t}</option>`
            ).join("")}
          </select>
          <button class="btn-remove-block" data-bi="${bi}">X</button>
        </div>
        <div class="block-meta">
          <label>Rounds:<input type="number" class="block-rounds" data-bi="${bi}" value="${block.rounds}" min="1" /></label>
          <label>Rest:<input type="number" class="block-rest" data-bi="${bi}" value="${block.restBetweenRounds}" min="0" />s</label>
          <label>Block rest:<input type="number" class="block-brest" data-bi="${bi}" value="${block.restAfterBlock}" min="0" />s</label>
        </div>`;

      // Exercises in block
      for (let ei = 0; ei < block.exercises.length; ei++) {
        const ex = block.exercises[ei]!;
        html += `<div class="exercise-row" data-bi="${bi}" data-ei="${ei}">
          <input type="text" class="ex-name" data-bi="${bi}" data-ei="${ei}" value="${esc(ex.name)}" placeholder="Exercise name" />
          <input type="text" class="ex-reps" data-bi="${bi}" data-ei="${ei}" value="${formatRepInput(ex.prescribedReps)}" placeholder="10 / 8-12 / AMRAP / 30s" />
          <input type="text" class="ex-load" data-bi="${bi}" data-ei="${ei}" value="${formatLoadInput(ex.prescribedLoad)}" placeholder="80kg / BW / RPE 8" />
          <input type="text" class="ex-notes" data-bi="${bi}" data-ei="${ei}" value="${esc(ex.notes ?? "")}" placeholder="Notes" />
          <button class="btn-remove-ex" data-bi="${bi}" data-ei="${ei}">X</button>
        </div>`;
      }

      html += `<button class="btn-add-exercise" data-bi="${bi}">+ Exercise</button>
      </div>`;
    }

    html += `<button class="btn-secondary" id="btn-add-block">+ Add Block</button>`;

    // Export markdown
    html += `<button class="btn-secondary" id="btn-export-md" style="margin-top:8px">Export as Markdown</button>`;
    html += `<div id="editor-error" class="error-text" style="margin-top:8px"></div>`;
    html += `<div id="export-result"></div>`;

    this.appEl.innerHTML = html;
    this.bindEditorEvents();
  }

  private bindEditorEvents(): void {
    document.getElementById("btn-back")?.addEventListener("click", () => {
      this.renderPlanList();
    });

    document.getElementById("btn-save")?.addEventListener("click", () => {
      this.saveCurrentPlan();
    });

    document.getElementById("btn-add-block")?.addEventListener("click", () => {
      if (!this.editingPlan) return;
      this.syncEditorToPlan();
      this.editingPlan.blocks.push({
        id: genId(),
        name: "",
        blockType: "straight",
        exercises: [],
        rounds: DEFAULTS.rounds,
        restBetweenExercises: DEFAULTS.restBetweenExercises,
        restBetweenRounds: DEFAULTS.restBetweenRounds,
        restAfterBlock: DEFAULTS.restAfterBlock,
      });
      this.renderEditorContent();
    });

    document.getElementById("btn-export-md")?.addEventListener("click", () => {
      this.clearEditorError();
      this.syncEditorToPlan();
      if (!this.editingPlan) return;
      const resultEl = document.getElementById("export-result");
      if (!resultEl) return;
      try {
        const md = exportToMarkdown(this.editingPlan);
        resultEl.innerHTML = `<div style="margin-top:12px">
          <label style="font-size:12px;color:#888;display:block;margin-bottom:4px">Markdown (select all & copy):</label>
          <textarea id="export-textarea" rows="10" readonly style="width:100%;padding:10px;border:1px solid #333;border-radius:10px;background:#1c1c1e;color:#e8e8e8;font:13px 'SF Mono','Menlo',monospace;resize:vertical">${esc(md)}</textarea>
          <button class="btn-secondary" id="btn-copy-md" style="margin-top:8px">Copy to clipboard</button>
        </div>`;
        const textarea = document.getElementById("export-textarea") as HTMLTextAreaElement;
        textarea?.focus();
        textarea?.select();
        document.getElementById("btn-copy-md")?.addEventListener("click", () => {
          textarea?.select();
          navigator.clipboard.writeText(md).then(() => {
            const copyBtn = document.getElementById("btn-copy-md");
            if (copyBtn) copyBtn.textContent = "Copied!";
          }).catch(() => {
            document.execCommand("copy");
            const copyBtn = document.getElementById("btn-copy-md");
            if (copyBtn) copyBtn.textContent = "Copied!";
          });
        });
      } catch (err: unknown) {
        this.showEditorError(`Export failed: ${String(err)}`);
      }
    });

    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-add-exercise")) {
      btn.addEventListener("click", () => {
        const bi = parseInt(btn.dataset["bi"] ?? "0", 10);
        const block = this.editingPlan?.blocks[bi];
        if (!block) return;
        block.exercises.push({
          id: genId(),
          name: "",
          prescribedReps: { type: "fixed", value: 10 },
          prescribedLoad: { type: "none" },
        });
        this.syncEditorToPlan();
        this.renderEditorContent();
      });
    }

    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-remove-block")) {
      btn.addEventListener("click", () => {
        const bi = parseInt(btn.dataset["bi"] ?? "0", 10);
        this.syncEditorToPlan();
        this.editingPlan?.blocks.splice(bi, 1);
        this.renderEditorContent();
      });
    }

    for (const btn of this.appEl.querySelectorAll<HTMLButtonElement>(".btn-remove-ex")) {
      btn.addEventListener("click", () => {
        const bi = parseInt(btn.dataset["bi"] ?? "0", 10);
        const ei = parseInt(btn.dataset["ei"] ?? "0", 10);
        this.syncEditorToPlan();
        this.editingPlan?.blocks[bi]?.exercises.splice(ei, 1);
        this.renderEditorContent();
      });
    }
  }

  private syncEditorToPlan(): void {
    if (!this.editingPlan) return;

    const nameEl = document.getElementById("plan-name") as HTMLInputElement | null;
    if (nameEl) this.editingPlan.name = nameEl.value.trim();

    const weekdayEl = document.getElementById("plan-weekday") as HTMLSelectElement | null;
    if (weekdayEl) {
      this.editingPlan.weekday = (weekdayEl.value || null) as TrainingPlan["weekday"];
    }

    for (let bi = 0; bi < this.editingPlan.blocks.length; bi++) {
      const block = this.editingPlan.blocks[bi]!;

      const blockName = this.appEl.querySelector<HTMLInputElement>(`.block-name[data-bi="${bi}"]`);
      if (blockName) block.name = blockName.value.trim();

      const blockType = this.appEl.querySelector<HTMLSelectElement>(`.block-type[data-bi="${bi}"]`);
      if (blockType) block.blockType = blockType.value as BlockType;

      const blockRounds = this.appEl.querySelector<HTMLInputElement>(`.block-rounds[data-bi="${bi}"]`);
      if (blockRounds) block.rounds = Math.max(1, parseInt(blockRounds.value, 10) || 1);

      const blockRest = this.appEl.querySelector<HTMLInputElement>(`.block-rest[data-bi="${bi}"]`);
      if (blockRest) block.restBetweenRounds = Math.max(0, parseInt(blockRest.value, 10) || 0);

      const blockBrest = this.appEl.querySelector<HTMLInputElement>(`.block-brest[data-bi="${bi}"]`);
      if (blockBrest) block.restAfterBlock = Math.max(0, parseInt(blockBrest.value, 10) || 0);

      for (let ei = 0; ei < block.exercises.length; ei++) {
        const ex = block.exercises[ei]!;

        const exName = this.appEl.querySelector<HTMLInputElement>(`.ex-name[data-bi="${bi}"][data-ei="${ei}"]`);
        if (exName) ex.name = exName.value.trim();

        const exReps = this.appEl.querySelector<HTMLInputElement>(`.ex-reps[data-bi="${bi}"][data-ei="${ei}"]`);
        if (exReps) ex.prescribedReps = parseRepInput(exReps.value);

        const exLoad = this.appEl.querySelector<HTMLInputElement>(`.ex-load[data-bi="${bi}"][data-ei="${ei}"]`);
        if (exLoad) ex.prescribedLoad = parseLoadInput(exLoad.value);

        const exNotes = this.appEl.querySelector<HTMLInputElement>(`.ex-notes[data-bi="${bi}"][data-ei="${ei}"]`);
        if (exNotes) {
          const notes = exNotes.value.trim();
          ex.notes = notes || undefined;
        }
      }
    }
  }

  private showEditorError(msg: string): void {
    const el = document.getElementById("editor-error");
    if (el) el.textContent = msg;
  }

  private clearEditorError(): void {
    const el = document.getElementById("editor-error");
    if (el) el.textContent = "";
  }

  private saveCurrentPlan(): void {
    this.clearEditorError();
    this.syncEditorToPlan();
    if (!this.editingPlan) return;

    if (!this.editingPlan.name) {
      this.showEditorError("Plan name is required.");
      return;
    }
    if (this.editingPlan.blocks.length === 0) {
      this.showEditorError("Add at least one block.");
      return;
    }
    for (const block of this.editingPlan.blocks) {
      if (block.exercises.length === 0) {
        this.showEditorError(`Block "${block.name || "Unnamed"}" needs at least one exercise.`);
        return;
      }
      for (const ex of block.exercises) {
        if (!ex.name) {
          this.showEditorError("All exercises need a name.");
          return;
        }
      }
    }

    this.editingPlan.updatedAt = Date.now();
    this.storage.savePlan(this.editingPlan);
    this.renderPlanList();
  }

  // --- Import ---

  private renderImport(): void {
    this.currentView = "import";

    const html = `<div class="view-header">
      <button class="btn-back" id="btn-back">Back</button>
      <h2>Import Plan</h2>
    </div>
    <div class="form-section">
      <label>Paste workout markdown:</label>
      <textarea id="import-text" rows="12" placeholder="# Plan Name\n\n## Block [superset] x3\n- rest: 60s\n\n### Exercise\n- reps: 10\n- load: 80kg"></textarea>
    </div>
    <div class="form-section">
      <label>Or upload a .md file:</label>
      <input type="file" id="import-file" accept=".md,.txt" />
    </div>
    <button class="btn-primary" id="btn-do-import">Import</button>
    <div id="import-error" class="error-text"></div>
    <div id="import-preview"></div>`;

    this.appEl.innerHTML = html;

    document.getElementById("btn-back")?.addEventListener("click", () => {
      this.renderPlanList();
    });

    document.getElementById("import-file")?.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const textarea = document.getElementById("import-text") as HTMLTextAreaElement;
        if (textarea && typeof reader.result === "string") {
          textarea.value = reader.result;
        }
      };
      reader.readAsText(file);
    });

    document.getElementById("btn-do-import")?.addEventListener("click", () => {
      const textarea = document.getElementById("import-text") as HTMLTextAreaElement;
      const errorEl = document.getElementById("import-error")!;
      const previewEl = document.getElementById("import-preview")!;

      errorEl.textContent = "";
      previewEl.innerHTML = "";

      const raw = textarea.value.trim();
      if (!raw) {
        errorEl.textContent = "Paste or upload markdown first.";
        return;
      }

      try {
        const plan = parseWorkoutMarkdown(raw);

        // Show preview
        let preview = `<div class="import-preview-card">
          <h3>${esc(plan.name)}</h3>
          <p>${plan.blocks.length} blocks, ${countTotalSets(plan)} total sets</p>`;
        for (const block of plan.blocks) {
          preview += `<div class="preview-block"><strong>${esc(block.name)}</strong> [${block.blockType}] x${block.rounds}`;
          for (const ex of block.exercises) {
            preview += `<br/>&nbsp;&nbsp;${esc(ex.name)} - ${formatReps(ex.prescribedReps)}${formatLoad(ex.prescribedLoad) ? " @ " + formatLoad(ex.prescribedLoad) : ""}`;
          }
          preview += `</div>`;
        }
        preview += `<button class="btn-primary" id="btn-confirm-import">Confirm Import</button></div>`;
        previewEl.innerHTML = preview;

        document.getElementById("btn-confirm-import")?.addEventListener("click", () => {
          this.storage.savePlan(plan);
          this.renderPlanList();
        });
      } catch (err: unknown) {
        errorEl.textContent = `Parse error: ${String(err)}`;
      }
    });
  }

  // --- Active Workout ---

  private renderActiveWorkout(session: WorkoutSession): void {
    this.currentView = "active";
    this.updateActiveWorkout(session);
  }

  private updateActiveWorkout(session: WorkoutSession): void {
    const info = getExerciseAtCursor(session.cursor, session.plan);
    const total = countTotalSets(session.plan);
    const setNum = flatSetIndex(session.cursor, session.plan);
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    let statusText = "In progress";
    if (session.paused) statusText = "Paused";
    if (session.cursor.phase === "rest" || session.cursor.phase === "blockRest") statusText = "Resting";

    let html = `<div class="view-header">
      <h2>Active Workout</h2>
    </div>
    <div class="active-card">
      <div class="active-plan-name">${esc(session.planName)}</div>
      <div class="active-status">${statusText}</div>
      <div class="active-progress">Set ${setNum}/${total} \u00B7 ${mins}:${secs.toString().padStart(2, "0")}</div>`;

    if (info) {
      html += `<div class="active-exercise">${esc(info.exercise.name)}</div>
        <div class="active-prescription">${formatReps(info.exercise.prescribedReps)}${formatLoad(info.exercise.prescribedLoad) ? " @ " + formatLoad(info.exercise.prescribedLoad) : ""}</div>
        <div class="active-block">${esc(info.blockName)} \u00B7 Round ${session.cursor.roundNumber}/${info.block.rounds}</div>`;
    }

    html += `</div>
    <button class="btn-danger" id="btn-abandon">Abandon Workout</button>
    <div id="abandon-confirm" class="confirm-row hidden">
      <span>Abandon this workout?</span>
      <button class="btn-danger" id="btn-abandon-yes">Yes, abandon</button>
      <button class="btn-secondary" id="btn-abandon-no">Cancel</button>
    </div>`;

    this.appEl.innerHTML = html;

    document.getElementById("btn-abandon")?.addEventListener("click", () => {
      const confirmRow = document.getElementById("abandon-confirm");
      if (confirmRow) confirmRow.classList.remove("hidden");
    });
    document.getElementById("btn-abandon-yes")?.addEventListener("click", () => {
      this.onAbandonWorkout();
    });
    document.getElementById("btn-abandon-no")?.addEventListener("click", () => {
      const confirmRow = document.getElementById("abandon-confirm");
      if (confirmRow) confirmRow.classList.add("hidden");
    });
  }

  // --- History ---

  private renderHistory(): void {
    this.currentView = "history";
    const logs = this.storage.loadLogs().reverse();

    let html = `<div class="view-header">
      <button class="btn-back" id="btn-back">Back</button>
      <h2>Workout History</h2>
    </div>`;

    if (logs.length === 0) {
      html += `<div class="empty-state">No workouts logged yet.</div>`;
    } else {
      html += `<div class="log-list">`;
      for (const log of logs) {
        const date = new Date(log.startedAt);
        const dateStr = date.toLocaleDateString();
        const mins = Math.floor(log.durationSeconds / 60);
        const secs = log.durationSeconds % 60;
        const icon = log.completionStatus === "completed" ? "\u2713" : "\u2717";
        html += `<div class="log-card">
          <div class="log-icon ${log.completionStatus}">${icon}</div>
          <div class="log-info">
            <div class="log-name">${esc(log.planName)}</div>
            <div class="log-meta">${dateStr} \u00B7 ${mins}:${secs.toString().padStart(2, "0")} \u00B7 ${log.totalSetsCompleted}/${log.totalSetsPlanned} sets</div>
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    this.appEl.innerHTML = html;

    document.getElementById("btn-back")?.addEventListener("click", () => {
      this.renderPlanList();
    });
  }
}

// --- Helpers ---

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRepInput(r: RepSpec): string {
  switch (r.type) {
    case "fixed": return `${r.value}`;
    case "range": return `${r.min}-${r.max}`;
    case "toFailure": return "AMRAP";
    case "timed": return `${r.seconds}s`;
  }
}

function formatLoadInput(l: LoadSpec): string {
  switch (l.type) {
    case "weight": return `${l.value}${l.unit}`;
    case "bodyweight": return "BW";
    case "rpe": return `RPE ${l.value}`;
    case "percentage": return `${l.value}%`;
    case "none": return "";
  }
}

function parseRepInput(value: string): RepSpec {
  const v = value.trim();
  if (/^amrap$/i.test(v)) return { type: "toFailure" };
  const timedMatch = v.match(/^(\d+)s$/i);
  if (timedMatch) return { type: "timed", seconds: parseInt(timedMatch[1]!, 10) };
  const rangeMatch = v.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) return { type: "range", min: parseInt(rangeMatch[1]!, 10), max: parseInt(rangeMatch[2]!, 10) };
  const fixed = parseInt(v, 10);
  if (!isNaN(fixed)) return { type: "fixed", value: fixed };
  return { type: "fixed", value: 10 };
}

function parseLoadInput(value: string): LoadSpec {
  const v = value.trim();
  if (!v) return { type: "none" };
  if (/^bw$/i.test(v) || /^bodyweight$/i.test(v)) return { type: "bodyweight" };
  const rpeMatch = v.match(/^rpe\s+(\d+(?:\.\d+)?)/i);
  if (rpeMatch) return { type: "rpe", value: parseFloat(rpeMatch[1]!) };
  const pctMatch = v.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) return { type: "percentage", value: parseFloat(pctMatch[1]!) };
  const weightMatch = v.match(/^(\d+(?:\.\d+)?)\s*(kg|lb)$/i);
  if (weightMatch) return { type: "weight", value: parseFloat(weightMatch[1]!), unit: weightMatch[2]!.toLowerCase() as "kg" | "lb" };
  return { type: "none" };
}

export function setPhoneState(state: "connecting" | "connected" | "error", text: string, detail?: string): void {
  const dot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const statusDetail = document.getElementById("status-detail");

  if (dot) dot.className = `status-indicator ${state}`;
  if (statusText) statusText.textContent = text;
  if (statusDetail) statusDetail.textContent = detail ?? "";
}
