import type {
  GestureEvent,
  GlassAdapter,
  StorageAdapter,
  TrainingPlan,
  Unsubscribe,
  WorkoutCursor,
  WorkoutLog,
  WorkoutSession,
} from "../types/contracts";
import type { WakeLockService } from "../services/wakeLockService";
import { WorkoutStateMachine } from "./state";
import { TimerEngine } from "../domain/timerEngine";
import {
  nextStep,
  countTotalSets,
  getExerciseAtCursor,
} from "../domain/workoutEngine";
import {
  formatExerciseScreen,
  formatRestScreen,
  formatRestTimerText,
  formatCompleteScreen,
  formatPausedScreen,
  formatRoutineSelectScreen,
} from "../domain/displayFormatter";

export interface ControllerOptions {
  glass: GlassAdapter;
  storage: StorageAdapter;
  wakeLock?: WakeLockService;
  onSessionChange?: (session: WorkoutSession | null) => void;
}

export class Controller {
  private static readonly IDLE_READY_MESSAGE = "FITNESS HUD\n\nTap to select routine\nor start from phone";
  private static readonly IDLE_EMPTY_MESSAGE = "FITNESS HUD\n\nNo plans found\nCreate one on your phone";
  private static readonly ABANDONED_MESSAGE = "FITNESS HUD\n\nWorkout abandoned\n\nTap to select routine\nor start from phone";

  private readonly glass: GlassAdapter;
  private readonly storage: StorageAdapter;
  private readonly wakeLock: WakeLockService | null;
  private readonly onSessionChange: ((session: WorkoutSession | null) => void) | null;
  private readonly state = new WorkoutStateMachine();
  private readonly timer = new TimerEngine();

  private unsubscribeGesture: Unsubscribe | null = null;
  private gestureQueue: Promise<void> = Promise.resolve();
  private started = false;

  // Saved rest context for timer callbacks
  private pendingRestCursor: WorkoutCursor | null = null;
  private pendingRestTotal = 0;
  private pendingIsBlockRest = false;

  // Saved routine plans for routine selection
  private routinePlans: TrainingPlan[] = [];

  constructor(options: ControllerOptions) {
    this.glass = options.glass;
    this.storage = options.storage;
    this.wakeLock = options.wakeLock ?? null;
    this.onSessionChange = options.onSessionChange ?? null;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await this.glass.connect();

    this.unsubscribeGesture = this.glass.onGesture((gesture) => {
      this.gestureQueue = this.gestureQueue
        .then(() => this.handleGesture(gesture))
        .catch((err: unknown) => {
          console.error("Gesture handling failed:", err);
        });
    });

    // Check for saved session to resume
    const savedSession = this.storage.loadSession();
    if (savedSession) {
      this.state.restoreWorkout(savedSession);
      await this.renderCurrentMode();
      await this.wakeLock?.acquire();
    } else {
      this.state.setIdle();
      const plans = this.storage.loadPlans();
      if (plans.length > 0) {
        await this.glass.showMessage(Controller.IDLE_READY_MESSAGE);
      } else {
        await this.glass.showMessage(Controller.IDLE_EMPTY_MESSAGE);
      }
    }

    this.notifySessionChange();
  }

  async stop(): Promise<void> {
    this.started = false;
    this.timer.stop();
    this.unsubscribeGesture?.();
    this.unsubscribeGesture = null;
    await this.wakeLock?.release();
  }

  // --- Public API for PhoneUI ---

  async startWorkout(planId: string): Promise<void> {
    const plans = this.storage.loadPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      console.error("[controller] Plan not found:", planId);
      return;
    }

    const session: WorkoutSession = {
      id: `${Date.now()}`,
      planId: plan.id,
      planName: plan.name,
      plan: structuredClone(plan),
      startedAt: Date.now(),
      cursor: { blockIndex: 0, exerciseIndex: 0, roundNumber: 1, phase: "exercise" },
      timerState: { active: false, totalSeconds: 0, remainingSeconds: 0, startedAtMs: 0 },
      paused: false,
      performedSets: [],
    };

    this.state.startWorkout(session);
    this.storage.saveSession(session);
    this.notifySessionChange();

    await this.renderExercise();
    await this.wakeLock?.acquire();
  }

  async abandonWorkout(): Promise<void> {
    const session = this.state.session;
    if (session) {
      const log = this.buildLog(session, "abandoned");
      this.storage.saveLog(log);
    }

    this.timer.stop();
    this.storage.clearSession();
    this.state.setIdle();
    this.notifySessionChange();

    await this.glass.showMessage(Controller.ABANDONED_MESSAGE);
    await this.wakeLock?.release();
  }

  getSession(): WorkoutSession | null {
    return this.state.session;
  }

  // --- Gesture dispatch ---

  private async handleGesture(gesture: GestureEvent): Promise<void> {
    if (gesture.kind === "FOREGROUND_ENTER") {
      await this.handleForegroundEnter();
      return;
    }
    if (gesture.kind === "FOREGROUND_EXIT") {
      await this.handleForegroundExit();
      return;
    }

    const mode = this.state.mode;

    if (mode === "IDLE") {
      if (gesture.kind === "TAP") {
        await this.showRoutineSelect();
      }
      return;
    }

    if (mode === "ROUTINE_SELECT") {
      if (gesture.kind === "TAP") {
        const idx = gesture.listIndex ?? 0;
        const plan = this.routinePlans[idx];
        if (plan) {
          await this.startWorkout(plan.id);
        }
      }
      return;
    }

    if (mode === "ACTIVE_EXERCISE") {
      if (gesture.kind === "TAP") {
        await this.handleExerciseAction(gesture.listIndex ?? 0);
      } else if (gesture.kind === "DOUBLE_TAP") {
        await this.handlePause();
      }
      return;
    }

    if (mode === "REST" || mode === "BLOCK_REST") {
      if (gesture.kind === "TAP") {
        await this.handleRestSkip();
      } else if (gesture.kind === "DOUBLE_TAP") {
        await this.handlePause();
      }
      return;
    }

    if (mode === "WORKOUT_COMPLETE") {
      if (gesture.kind === "TAP") {
        await this.handleCompleteDismiss();
      }
      return;
    }

    if (mode === "PAUSED") {
      if (gesture.kind === "TAP") {
        await this.handleResume();
      }
      return;
    }

    if (mode === "ERROR") {
      if (gesture.kind === "TAP") {
        this.state.setIdle();
        await this.glass.showMessage(Controller.IDLE_READY_MESSAGE);
      }
    }
  }

  // --- Routine selection ---

  private async showRoutineSelect(): Promise<void> {
    const plans = this.storage.loadPlans();
    if (plans.length === 0) return;

    if (plans.length === 1) {
      await this.startWorkout(plans[0]!.id);
      return;
    }

    this.routinePlans = plans;
    this.state.setRoutineSelect();
    const screen = formatRoutineSelectScreen(plans);
    await this.glass.showScreen(screen);
  }

  // --- Exercise handling ---

  private async handleExerciseAction(actionIndex: number): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    // actionIndex: 0 = "Done", 1 = "Skip"
    const skipped = actionIndex === 1;

    // Record performed set
    this.state.recordSet({
      blockIndex: session.cursor.blockIndex,
      exerciseIndex: session.cursor.exerciseIndex,
      roundNumber: session.cursor.roundNumber,
      completedAt: Date.now(),
      skipped,
    });

    // Compute next step
    const result = nextStep(session.cursor, session.plan);

    if (result.done) {
      await this.completeWorkout();
      return;
    }

    // Update cursor
    this.state.updateCursor(result.cursor);

    if (result.restSeconds > 0 && result.cursor.phase !== "exercise") {
      // Start rest timer
      const isBlockRest = result.cursor.phase === "blockRest";
      if (isBlockRest) {
        this.state.setBlockRest();
      } else {
        this.state.setRest();
      }
      await this.startRestTimer(result.restSeconds, result.cursor, isBlockRest);
    } else {
      // No rest, go directly to next exercise
      this.state.setActiveExercise();
      await this.renderExercise();
    }

    this.persistSession();
  }

  // --- Rest handling ---

  private async startRestTimer(
    seconds: number,
    cursor: WorkoutCursor,
    isBlockRest: boolean,
  ): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    this.pendingRestCursor = cursor;
    this.pendingRestTotal = seconds;
    this.pendingIsBlockRest = isBlockRest;

    this.state.updateTimerState({
      active: true,
      totalSeconds: seconds,
      remainingSeconds: seconds,
      startedAtMs: Date.now(),
    });

    // Render full rest screen (text + action list)
    const screen = formatRestScreen(seconds, cursor, session.plan, isBlockRest);
    await this.glass.showScreen(screen);

    this.timer.start(
      seconds,
      (remaining) => {
        if (!this.state.session) return;
        this.state.updateTimerState({
          ...this.state.session.timerState,
          remainingSeconds: remaining,
        });
        // Update ONLY the text container (action list stays the same)
        const text = formatRestTimerText(
          remaining,
          this.pendingRestCursor!,
          this.state.session.plan,
          this.pendingIsBlockRest,
        );
        void this.glass.updateText(text);
      },
      () => {
        void this.handleRestComplete();
      },
    );
  }

  private async handleRestComplete(): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    this.state.updateTimerState({
      active: false, totalSeconds: 0, remainingSeconds: 0, startedAtMs: 0,
    });

    // Auto-advance to next exercise (no READY_PROMPT)
    this.state.setActiveExercise();
    await this.renderExercise();
    this.persistSession();
  }

  private async handleRestSkip(): Promise<void> {
    this.timer.stop();

    const session = this.state.session;
    if (!session) return;

    this.state.updateTimerState({
      active: false, totalSeconds: 0, remainingSeconds: 0, startedAtMs: 0,
    });
    this.state.setActiveExercise();
    await this.renderExercise();
    this.persistSession();
  }

  // --- Pause / Resume ---

  private async handlePause(): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    this.timer.stop();
    this.state.setPaused();

    const screen = formatPausedScreen(session.plan);
    await this.glass.showScreen(screen);
    this.persistSession();
  }

  private async handleResume(): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    session.paused = false;

    // If we were in a rest phase, resume the timer
    if (session.timerState.active && session.timerState.startedAtMs > 0) {
      const endMs = session.timerState.startedAtMs + session.timerState.totalSeconds * 1000;
      const remaining = endMs - Date.now();

      if (remaining > 0) {
        const isBlockRest = session.cursor.phase === "blockRest";
        if (isBlockRest) {
          this.state.setBlockRest();
        } else {
          this.state.setRest();
        }

        this.pendingRestCursor = session.cursor;
        this.pendingRestTotal = session.timerState.totalSeconds;
        this.pendingIsBlockRest = isBlockRest;

        const secs = Math.ceil(remaining / 1000);
        const screen = formatRestScreen(secs, session.cursor, session.plan, isBlockRest);
        await this.glass.showScreen(screen);

        this.timer.resumeFrom(
          endMs,
          (rem) => {
            if (!this.state.session) return;
            this.state.updateTimerState({ ...this.state.session.timerState, remainingSeconds: rem });
            const text = formatRestTimerText(
              rem, this.pendingRestCursor!, this.state.session.plan, this.pendingIsBlockRest,
            );
            void this.glass.updateText(text);
          },
          () => { void this.handleRestComplete(); },
        );
      } else {
        // Rest already expired
        await this.handleRestComplete();
      }
    } else {
      this.state.setActiveExercise();
      await this.renderExercise();
    }

    this.persistSession();
  }

  // --- Completion ---

  private async completeWorkout(): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    this.timer.stop();
    this.state.setWorkoutComplete();

    const log = this.buildLog(session, "completed");
    this.storage.saveLog(log);
    this.storage.clearSession();

    const totalSets = countTotalSets(session.plan);
    const durationSecs = Math.floor((Date.now() - session.startedAt) / 1000);
    const screen = formatCompleteScreen(
      session.plan, durationSecs, session.performedSets.length, totalSets,
    );

    await this.glass.showScreen(screen);
    this.notifySessionChange();
  }

  private async handleCompleteDismiss(): Promise<void> {
    this.state.setIdle();
    this.notifySessionChange();
    await this.glass.showMessage(Controller.IDLE_READY_MESSAGE);
    await this.wakeLock?.release();
  }

  // --- Foreground lifecycle ---

  private async handleForegroundEnter(): Promise<void> {
    if (this.state.session) {
      await this.wakeLock?.acquire();
    }
    await this.renderCurrentMode();
  }

  private async handleForegroundExit(): Promise<void> {
    this.persistSession();
    await this.wakeLock?.release();
  }

  // --- Render helpers ---

  private async renderExercise(): Promise<void> {
    const session = this.state.session;
    if (!session) return;

    const info = getExerciseAtCursor(session.cursor, session.plan);
    if (!info) return;

    const totalSets = countTotalSets(session.plan);
    const setsCompleted = session.performedSets.length;

    const screen = formatExerciseScreen(
      session.cursor, session.plan, info.block, info.exercise,
      setsCompleted, totalSets,
    );
    await this.glass.showScreen(screen);
  }

  private async renderCurrentMode(): Promise<void> {
    const mode = this.state.mode;
    const session = this.state.session;

    if (!session) {
      const plans = this.storage.loadPlans();
      if (plans.length > 0) {
        await this.glass.showMessage(Controller.IDLE_READY_MESSAGE);
      } else {
        await this.glass.showMessage(Controller.IDLE_EMPTY_MESSAGE);
      }
      return;
    }

    switch (mode) {
      case "ACTIVE_EXERCISE":
        await this.renderExercise();
        break;
      case "PAUSED": {
        const screen = formatPausedScreen(session.plan);
        await this.glass.showScreen(screen);
        break;
      }
      case "REST":
      case "BLOCK_REST": {
        // Resume timer if it was active
        if (session.timerState.active) {
          await this.handleResume();
        }
        break;
      }
      case "WORKOUT_COMPLETE": {
        const totalSets = countTotalSets(session.plan);
        const durationSecs = Math.floor((Date.now() - session.startedAt) / 1000);
        const screen = formatCompleteScreen(
          session.plan, durationSecs, session.performedSets.length, totalSets,
        );
        await this.glass.showScreen(screen);
        break;
      }
      default:
        await this.glass.showMessage(Controller.IDLE_READY_MESSAGE);
    }
  }

  // --- Helpers ---

  private persistSession(): void {
    const session = this.state.session;
    if (session) {
      this.storage.saveSession(session);
    }
    this.notifySessionChange();
  }

  private notifySessionChange(): void {
    this.onSessionChange?.(this.state.session);
  }

  private buildLog(
    session: WorkoutSession,
    status: "completed" | "abandoned",
  ): WorkoutLog {
    const now = Date.now();
    return {
      id: `log-${now}`,
      planId: session.planId,
      planName: session.planName,
      startedAt: session.startedAt,
      completedAt: now,
      durationSeconds: Math.floor((now - session.startedAt) / 1000),
      completionStatus: status,
      performedSets: [...session.performedSets],
      totalSetsCompleted: session.performedSets.length,
      totalSetsPlanned: countTotalSets(session.plan),
    };
  }
}
