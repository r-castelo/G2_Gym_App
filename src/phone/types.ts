import type { TrainingPlan } from "../types/contracts";

export type PhoneRoute = "status" | "plans" | "editor" | "import" | "active" | "history";

export interface PhoneStatusState {
  state: "connecting" | "connected" | "error";
  text: string;
  detail?: string;
}

export interface PhoneUIState {
  route: PhoneRoute;
  deletePlanId: string | null;
  importDraft: string;
  importError: string;
  importPreviewPlan: TrainingPlan | null;
  editorError: string;
  exportMarkdown: string | null;
  activeAlertOpen: boolean;
}
