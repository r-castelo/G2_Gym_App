import type {
  AppMode,
  PerformedSet,
  TimerState,
  TrainingPlan,
  WorkoutCursor,
  WorkoutSession,
} from "../types/contracts";

export interface WorkoutState {
  mode: AppMode;
  session: WorkoutSession | null;
}

export class WorkoutStateMachine {
  private state: WorkoutState;

  constructor() {
    this.state = {
      mode: "BOOT",
      session: null,
    };
  }

  get mode(): AppMode {
    return this.state.mode;
  }

  get session(): WorkoutSession | null {
    return this.state.session;
  }

  get snapshot(): Readonly<WorkoutState> {
    return this.state;
  }

  // --- Mode transitions ---

  setIdle(): void {
    this.state.mode = "IDLE";
    this.state.session = null;
  }

  setError(): void {
    this.state.mode = "ERROR";
  }

  startWorkout(session: WorkoutSession): void {
    this.state.mode = "ACTIVE_EXERCISE";
    this.state.session = session;
  }

  restoreWorkout(session: WorkoutSession): void {
    this.state.session = session;
    this.state.mode = session.paused
      ? "PAUSED"
      : session.cursor.phase === "rest" || session.cursor.phase === "blockRest"
        ? session.cursor.phase === "blockRest" ? "BLOCK_REST" : "REST"
        : "ACTIVE_EXERCISE";
  }

  setActiveExercise(): void {
    this.state.mode = "ACTIVE_EXERCISE";
    if (this.state.session) {
      this.state.session.cursor.phase = "exercise";
      this.state.session.paused = false;
    }
  }

  setRest(): void {
    this.state.mode = "REST";
    if (this.state.session) {
      this.state.session.cursor.phase = "rest";
    }
  }

  setBlockRest(): void {
    this.state.mode = "BLOCK_REST";
    if (this.state.session) {
      this.state.session.cursor.phase = "blockRest";
    }
  }

  setRoutineSelect(): void {
    this.state.mode = "ROUTINE_SELECT";
  }

  setWorkoutComplete(): void {
    this.state.mode = "WORKOUT_COMPLETE";
  }

  setPaused(): void {
    this.state.mode = "PAUSED";
    if (this.state.session) {
      this.state.session.paused = true;
    }
  }

  // --- Session mutations ---

  updateCursor(cursor: WorkoutCursor): void {
    if (this.state.session) {
      this.state.session.cursor = cursor;
    }
  }

  updateTimerState(timer: TimerState): void {
    if (this.state.session) {
      this.state.session.timerState = timer;
    }
  }

  recordSet(set: PerformedSet): void {
    if (this.state.session) {
      this.state.session.performedSets.push(set);
    }
  }
}
