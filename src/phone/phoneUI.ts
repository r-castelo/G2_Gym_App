import { DEFAULTS } from "../config/constants";
import { parseWorkoutMarkdown } from "../domain/markdownImporter";
import { exportToMarkdown } from "../domain/markdownExporter";
import type {
  BlockType,
  StorageAdapter,
  TrainingPlan,
  WeightUnit,
  WorkoutSession,
} from "../types/contracts";
import { renderActiveView } from "./views/activeView";
import { renderEditorView } from "./views/editorView";
import { renderHistoryView } from "./views/historyView";
import { renderImportView } from "./views/importView";
import { renderPlansView } from "./views/plansView";
import { renderStatusView } from "./views/statusView";
import type { PhoneStatusState, PhoneUIState } from "./types";
import {
  findActionElement,
  genId,
  getDatasetInt,
  parseLoadInput,
  parseRepInput,
  presentConfirmAlert,
  presentToast,
  readEventValue,
} from "./utils";

export interface PhoneUIOptions {
  storage: StorageAdapter;
  onStartWorkout: (planId: string) => void;
  onAbandonWorkout: () => void;
}

const initialStatusState: PhoneStatusState = {
  state: "connecting",
  text: "Connecting to glasses...",
  detail: "",
};

let statusState: PhoneStatusState = { ...initialStatusState };

function renderStatusScreen(): void {
  const statusEl = document.getElementById("status-screen");
  if (!statusEl) return;
  statusEl.innerHTML = renderStatusView(statusState);
}

export class PhoneUI {
  private readonly storage: StorageAdapter;
  private readonly onStartWorkout: (planId: string) => void;
  private readonly onAbandonWorkout: () => void;

  private editingPlan: TrainingPlan | null = null;
  private activeSession: WorkoutSession | null = null;

  private readonly uiState: PhoneUIState = {
    route: "plans",
    deletePlanId: null,
    importDraft: "",
    importError: "",
    importPreviewPlan: null,
    editorError: "",
    exportMarkdown: null,
    activeAlertOpen: false,
  };

  private readonly appEl: HTMLElement;
  private readonly statusEl: HTMLElement;

  constructor(options: PhoneUIOptions) {
    this.storage = options.storage;
    this.onStartWorkout = options.onStartWorkout;
    this.onAbandonWorkout = options.onAbandonWorkout;

    this.appEl = document.getElementById("app-content")!;
    this.statusEl = document.getElementById("status-screen")!;

    this.appEl.addEventListener("click", this.handleClick);
    this.appEl.addEventListener("input", this.handleModelEvent);
    this.appEl.addEventListener("change", this.handleModelEvent);
    this.appEl.addEventListener("change", this.handleNativeChange);

    renderStatusScreen();
  }

  show(): void {
    this.statusEl.classList.add("hidden");
    this.appEl.classList.remove("hidden");
    this.uiState.route = "plans";
    this.render();
  }

  onSessionUpdate(session: WorkoutSession | null): void {
    this.activeSession = session;

    if (session) {
      this.uiState.route = "active";
      this.render();
      return;
    }

    if (this.uiState.route === "active") {
      this.uiState.route = "plans";
      this.render();
    }
  }

  private render(): void {
    switch (this.uiState.route) {
      case "plans": {
        this.appEl.innerHTML = renderPlansView({
          plans: this.storage.loadPlans(),
          unit: this.storage.loadUnitPreference(),
          deletePlanId: this.uiState.deletePlanId,
        });
        return;
      }

      case "editor": {
        if (!this.editingPlan) {
          this.uiState.route = "plans";
          this.render();
          return;
        }
        this.appEl.innerHTML = renderEditorView({
          plan: this.editingPlan,
          error: this.uiState.editorError,
          exportMarkdown: this.uiState.exportMarkdown,
        });
        return;
      }

      case "import": {
        this.appEl.innerHTML = renderImportView({
          draft: this.uiState.importDraft,
          error: this.uiState.importError,
          previewPlan: this.uiState.importPreviewPlan,
        });
        return;
      }

      case "active": {
        if (!this.activeSession) {
          this.uiState.route = "plans";
          this.render();
          return;
        }
        this.appEl.innerHTML = renderActiveView({ session: this.activeSession });
        return;
      }

      case "history": {
        this.appEl.innerHTML = renderHistoryView({
          logs: this.storage.loadLogs().slice().reverse(),
        });
        return;
      }

      case "status": {
        this.appEl.innerHTML = "";
      }
    }
  }

  private readonly handleClick = (event: Event): void => {
    const actionEl = findActionElement(event);
    if (!actionEl) return;

    void this.dispatchAction(actionEl, event);
  };

  private async dispatchAction(actionEl: HTMLElement, event: Event): Promise<void> {
    const action = actionEl.dataset["action"];
    if (!action) return;

    if (action === "remove-block" || action === "remove-set") {
      event.stopPropagation();
      event.preventDefault();
    }

    switch (action) {
      case "open-plans": {
        this.uiState.route = "plans";
        this.render();
        return;
      }

      case "open-import": {
        this.uiState.route = "import";
        this.uiState.importError = "";
        this.uiState.importPreviewPlan = null;
        this.render();
        return;
      }

      case "open-history": {
        this.uiState.route = "history";
        this.render();
        return;
      }

      case "clear-history": {
        const logs = this.storage.loadLogs();
        if (logs.length === 0) {
          await presentToast("History already empty");
          return;
        }

        const confirmed = await presentConfirmAlert({
          header: "Clear History",
          message: "Delete all workout logs?",
          confirmText: "Clear",
          confirmRole: "confirm",
        });
        if (!confirmed) return;

        this.storage.clearLogs();
        await presentToast("History cleared");
        this.render();
        return;
      }

      case "new-plan": {
        this.openEditor(null);
        return;
      }

      case "edit-plan": {
        const id = actionEl.dataset["planId"];
        if (!id) return;
        const plan = this.storage.loadPlans().find((p) => p.id === id);
        if (!plan) return;
        this.openEditor(plan);
        return;
      }

      case "start-plan": {
        const id = actionEl.dataset["planId"];
        if (id) this.onStartWorkout(id);
        return;
      }

      case "ask-delete-plan": {
        const id = actionEl.dataset["planId"];
        if (!id) return;

        this.uiState.deletePlanId = id;
        this.render();

        const confirmed = await presentConfirmAlert({
          header: "Delete Plan",
          message: "Delete this plan permanently?",
          confirmText: "Delete",
          confirmRole: "confirm",
        });

        this.uiState.deletePlanId = null;

        if (confirmed) {
          this.storage.deletePlan(id);
          await presentToast("Plan deleted");
        }

        this.render();
        return;
      }

      case "add-block": {
        if (!this.editingPlan) return;
        this.editingPlan.blocks.push(this.makeEmptyBlock());
        this.uiState.editorError = "";
        this.render();
        return;
      }

      case "remove-block": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(actionEl.dataset["bi"]);
        this.editingPlan.blocks.splice(bi, 1);
        this.uiState.editorError = "";
        this.render();
        return;
      }

      case "add-set": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(actionEl.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;

        block.exercises.push({
          id: genId(),
          name: "",
          prescribedReps: { type: "fixed", value: 10 },
          prescribedLoad: { type: "none" },
        });

        this.uiState.editorError = "";
        this.render();
        return;
      }

      case "remove-set": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(actionEl.dataset["bi"]);
        const ei = getDatasetInt(actionEl.dataset["ei"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        block.exercises.splice(ei, 1);
        this.uiState.editorError = "";
        this.render();
        return;
      }

      case "save-plan": {
        this.saveCurrentPlan();
        return;
      }

      case "export-markdown": {
        if (!this.editingPlan) return;
        try {
          this.uiState.exportMarkdown = exportToMarkdown(this.editingPlan);
          this.uiState.editorError = "";
        } catch (err: unknown) {
          this.uiState.editorError = `Export failed: ${String(err)}`;
        }
        this.render();
        return;
      }

      case "copy-markdown": {
        const md = this.uiState.exportMarkdown;
        if (!md) return;
        try {
          await navigator.clipboard.writeText(md);
          await presentToast("Copied");
        } catch {
          await presentToast("Copy failed");
        }
        return;
      }

      case "parse-import": {
        this.parseImportDraft();
        return;
      }

      case "confirm-import": {
        const plan = this.uiState.importPreviewPlan;
        if (!plan) return;
        this.storage.savePlan(plan);
        this.uiState.importPreviewPlan = null;
        this.uiState.importError = "";
        this.uiState.route = "plans";
        this.render();
        return;
      }

      case "abandon-workout": {
        if (this.uiState.activeAlertOpen) return;
        this.uiState.activeAlertOpen = true;
        const confirmed = await presentConfirmAlert({
          header: "Abandon Workout",
          message: "Are you sure you want to abandon this workout?",
          confirmText: "Abandon",
          confirmRole: "confirm",
        });
        this.uiState.activeAlertOpen = false;
        if (confirmed) this.onAbandonWorkout();
        return;
      }
    }
  }

  private readonly handleModelEvent = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const model = target.dataset["model"];
    if (!model) return;

    const value = readEventValue(event);

    switch (model) {
      case "unit-preference": {
        this.storage.saveUnitPreference((value || "kg") as WeightUnit);
        return;
      }

      case "import-draft": {
        this.uiState.importDraft = value;
        this.uiState.importError = "";
        this.uiState.importPreviewPlan = null;
        return;
      }

      case "plan-name": {
        if (!this.editingPlan) return;
        this.editingPlan.name = value.trim();
        this.uiState.editorError = "";
        return;
      }

      case "plan-weekday": {
        if (!this.editingPlan) return;
        this.editingPlan.weekday = (value || null) as TrainingPlan["weekday"];
        return;
      }

      case "block-name": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(target.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        block.name = value.trim();
        return;
      }

      case "block-type": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(target.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        block.blockType = value as BlockType;
        return;
      }

      case "block-rounds": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(target.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        block.rounds = Math.max(1, parseInt(value, 10) || 1);
        return;
      }

      case "block-rest": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(target.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        const rest = Math.max(0, parseInt(value, 10) || 0);
        block.restBetweenRounds = rest;
        block.restBetweenExercises = rest;
        return;
      }

      case "block-rest-after": {
        if (!this.editingPlan) return;
        const bi = getDatasetInt(target.dataset["bi"]);
        const block = this.editingPlan.blocks[bi];
        if (!block) return;
        block.restAfterBlock = Math.max(0, parseInt(value, 10) || 0);
        return;
      }

      case "set-exercise": {
        const set = this.getEditingSet(target);
        if (!set) return;
        set.name = value.trim();
        return;
      }

      case "set-reps": {
        const set = this.getEditingSet(target);
        if (!set) return;
        set.prescribedReps = parseRepInput(value);
        return;
      }

      case "set-load": {
        const set = this.getEditingSet(target);
        if (!set) return;
        set.prescribedLoad = parseLoadInput(value);
        return;
      }

      case "set-notes": {
        const set = this.getEditingSet(target);
        if (!set) return;
        const notes = value.trim();
        set.notes = notes || undefined;
        return;
      }
    }
  };

  private readonly handleNativeChange = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id !== "import-file") return;

    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      this.uiState.importDraft = reader.result;
      this.uiState.importError = "";
      this.uiState.importPreviewPlan = null;
      if (this.uiState.route === "import") this.render();
    };
    reader.readAsText(file);
  };

  private parseImportDraft(): void {
    const raw = this.uiState.importDraft.trim();
    if (!raw) {
      this.uiState.importError = "Paste or upload markdown first.";
      this.uiState.importPreviewPlan = null;
      this.render();
      return;
    }

    try {
      this.uiState.importPreviewPlan = parseWorkoutMarkdown(raw);
      this.uiState.importError = "";
    } catch (err: unknown) {
      this.uiState.importPreviewPlan = null;
      this.uiState.importError = `Parse error: ${String(err)}`;
    }

    this.render();
  }

  private openEditor(plan: TrainingPlan | null): void {
    this.editingPlan = plan
      ? structuredClone(plan)
      : {
        id: genId(),
        name: "",
        weekday: null,
        blocks: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

    this.uiState.route = "editor";
    this.uiState.editorError = "";
    this.uiState.exportMarkdown = null;
    this.render();
  }

  private makeEmptyBlock() {
    return {
      id: genId(),
      name: "",
      blockType: "straight" as BlockType,
      exercises: [],
      rounds: DEFAULTS.rounds,
      restBetweenExercises: DEFAULTS.restBetweenRounds,
      restBetweenRounds: DEFAULTS.restBetweenRounds,
      restAfterBlock: DEFAULTS.restAfterBlock,
    };
  }

  private getEditingSet(targetEl: HTMLElement) {
    if (!this.editingPlan) return null;
    const bi = getDatasetInt(targetEl.dataset["bi"]);
    const ei = getDatasetInt(targetEl.dataset["ei"]);
    const block = this.editingPlan.blocks[bi];
    if (!block) return null;
    return block.exercises[ei] ?? null;
  }

  private saveCurrentPlan(): void {
    this.uiState.editorError = "";
    const plan = this.editingPlan;
    if (!plan) return;

    if (!plan.name.trim()) {
      this.uiState.editorError = "Plan name is required.";
      this.render();
      return;
    }

    if (plan.blocks.length === 0) {
      this.uiState.editorError = "Add at least one block.";
      this.render();
      return;
    }

    for (const block of plan.blocks) {
      if (block.exercises.length === 0) {
        this.uiState.editorError = `Block "${block.name || "Unnamed"}" needs at least one set.`;
        this.render();
        return;
      }

      for (const set of block.exercises) {
        if (!set.name.trim()) {
          this.uiState.editorError = "All sets need an exercise name.";
          this.render();
          return;
        }
      }
    }

    plan.updatedAt = Date.now();
    this.storage.savePlan(plan);

    this.uiState.route = "plans";
    this.uiState.exportMarkdown = null;
    this.render();
  }
}

export function setPhoneState(state: "connecting" | "connected" | "error", text: string, detail?: string): void {
  statusState = {
    state,
    text,
    detail: detail ?? "",
  };

  renderStatusScreen();
}
