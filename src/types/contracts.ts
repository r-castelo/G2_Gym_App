export type Unsubscribe = () => void;

// --- App Modes ---

export type AppMode =
  | "BOOT"
  | "IDLE"
  | "ROUTINE_SELECT"
  | "ACTIVE_EXERCISE"
  | "REST"
  | "BLOCK_REST"
  | "WORKOUT_COMPLETE"
  | "PAUSED"
  | "ERROR";

// --- Gestures ---

export type GestureKind =
  | "SCROLL_FWD"
  | "SCROLL_BACK"
  | "TAP"
  | "DOUBLE_TAP"
  | "FOREGROUND_ENTER"
  | "FOREGROUND_EXIT";

export interface GestureEvent {
  kind: GestureKind;
  listIndex?: number;
}

// --- Display ---

export interface TextScreen {
  kind: "text";
  content: string;
}

export interface TextListScreen {
  kind: "textList";
  content: string;
  actions: string[];
}

export interface ListScreen {
  kind: "list";
  title: string;
  items: string[];
}

export type GlassScreen = TextScreen | TextListScreen | ListScreen;

// --- Domain Model ---

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type BlockType = "straight" | "superset" | "circuit";

export type RepSpec =
  | { type: "fixed"; value: number }
  | { type: "range"; min: number; max: number }
  | { type: "toFailure" }
  | { type: "timed"; seconds: number };

export type LoadSpec =
  | { type: "weight"; value: number; unit: "kg" | "lb" }
  | { type: "bodyweight" }
  | { type: "rpe"; value: number }
  | { type: "percentage"; value: number }
  | { type: "none" };

export type WeightUnit = "kg" | "lb";

export interface Exercise {
  id: string;
  name: string;
  prescribedReps: RepSpec;
  prescribedLoad: LoadSpec;
  notes?: string;
}

export interface Block {
  id: string;
  name: string;
  blockType: BlockType;
  exercises: Exercise[];
  rounds: number;
  restBetweenExercises: number;
  restBetweenRounds: number;
  restAfterBlock: number;
}

export interface TrainingPlan {
  id: string;
  name: string;
  weekday?: Weekday | null;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

// --- Workout Session (active state) ---

export interface WorkoutCursor {
  blockIndex: number;
  exerciseIndex: number;
  roundNumber: number;
  phase: "exercise" | "rest" | "blockRest";
}

export interface TimerState {
  active: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  startedAtMs: number;
}

export interface PerformedSet {
  blockIndex: number;
  exerciseIndex: number;
  roundNumber: number;
  actualReps?: number;
  actualLoad?: LoadSpec;
  completedAt: number;
  skipped?: boolean;
}

export interface WorkoutSession {
  id: string;
  planId: string;
  planName: string;
  plan: TrainingPlan;
  startedAt: number;
  cursor: WorkoutCursor;
  timerState: TimerState;
  paused: boolean;
  performedSets: PerformedSet[];
}

// --- Workout Log (history) ---

export interface WorkoutLog {
  id: string;
  planId: string;
  planName: string;
  startedAt: number;
  completedAt: number;
  durationSeconds: number;
  completionStatus: "completed" | "abandoned";
  performedSets: PerformedSet[];
  totalSetsCompleted: number;
  totalSetsPlanned: number;
}

// --- Adapter Interfaces ---

export interface GlassAdapter {
  connect(): Promise<void>;
  onGesture(handler: (event: GestureEvent) => void): Unsubscribe;
  showScreen(screen: GlassScreen): Promise<void>;
  updateText(content: string): Promise<void>;
  showMessage(text: string): Promise<void>;
}

export interface StorageAdapter {
  loadPlans(): TrainingPlan[];
  savePlan(plan: TrainingPlan): void;
  deletePlan(planId: string): void;

  loadSession(): WorkoutSession | null;
  saveSession(session: WorkoutSession): void;
  clearSession(): void;

  loadLogs(): WorkoutLog[];
  saveLog(log: WorkoutLog): void;

  loadUnitPreference(): WeightUnit;
  saveUnitPreference(unit: WeightUnit): void;
}
