/**
 * Drift-corrected countdown timer.
 * Uses Date.now() reference timestamps instead of counting intervals.
 * Ticks at 250ms for responsive display, only fires onTick when
 * the displayed seconds value changes.
 */
export class TimerEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private endMs = 0;
  private lastDisplayedSeconds = -1;

  start(
    durationSeconds: number,
    onTick: (remainingSeconds: number) => void,
    onComplete: () => void,
  ): void {
    this.stop();

    const now = Date.now();
    this.endMs = now + durationSeconds * 1000;
    this.lastDisplayedSeconds = durationSeconds;

    onTick(durationSeconds);

    this.intervalId = setInterval(() => {
      const remaining = this.endMs - Date.now();

      if (remaining <= 0) {
        this.stop();
        onTick(0);
        onComplete();
        return;
      }

      const seconds = Math.ceil(remaining / 1000);
      if (seconds !== this.lastDisplayedSeconds) {
        this.lastDisplayedSeconds = seconds;
        onTick(seconds);
      }
    }, 250);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Recalculate remaining time from a saved start timestamp. */
  resumeFrom(
    originalEndMs: number,
    onTick: (remainingSeconds: number) => void,
    onComplete: () => void,
  ): void {
    this.stop();

    const now = Date.now();
    const remaining = originalEndMs - now;

    if (remaining <= 0) {
      onTick(0);
      onComplete();
      return;
    }

    this.endMs = originalEndMs;
    this.lastDisplayedSeconds = Math.ceil(remaining / 1000);
    onTick(this.lastDisplayedSeconds);

    this.intervalId = setInterval(() => {
      const rem = this.endMs - Date.now();

      if (rem <= 0) {
        this.stop();
        onTick(0);
        onComplete();
        return;
      }

      const seconds = Math.ceil(rem / 1000);
      if (seconds !== this.lastDisplayedSeconds) {
        this.lastDisplayedSeconds = seconds;
        onTick(seconds);
      }
    }, 250);
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }

  get remainingMs(): number {
    if (!this.isRunning) return 0;
    return Math.max(0, this.endMs - Date.now());
  }

  get endTimeMs(): number {
    return this.endMs;
  }
}
