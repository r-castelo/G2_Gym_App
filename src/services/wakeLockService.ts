/**
 * Screen Wake Lock service — prevents the phone from sleeping
 * while the user is in an active workout.
 *
 * Uses the W3C Screen Wake Lock API (navigator.wakeLock).
 * Best-effort: silently no-ops if the API is unavailable.
 * Re-acquires automatically when the page regains visibility.
 */

export interface WakeLockService {
  acquire(): Promise<void>;
  release(): Promise<void>;
}

export class WakeLockServiceImpl implements WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  private wantLock = false;
  private boundVisibilityHandler: (() => void) | null = null;
  private boundPageShowHandler: (() => void) | null = null;

  async acquire(): Promise<void> {
    this.wantLock = true;
    this.ensureVisibilityListener();
    await this.requestLock();
  }

  async release(): Promise<void> {
    this.wantLock = false;
    await this.releaseLock();
  }

  private async requestLock(): Promise<void> {
    if (this.sentinel) return;

    if (!("wakeLock" in navigator)) {
      console.log("[wakelock] API not available");
      return;
    }

    try {
      this.sentinel = await navigator.wakeLock.request("screen");
      this.sentinel.addEventListener("release", () => {
        this.sentinel = null;
        if (this.wantLock && document.visibilityState === "visible") {
          void this.requestLock();
        }
      });
      console.log("[wakelock] Acquired");
    } catch (err) {
      console.warn("[wakelock] Failed to acquire:", err);
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.sentinel) return;

    try {
      await this.sentinel.release();
      console.log("[wakelock] Released");
    } catch {
      // Best effort
    }
    this.sentinel = null;
  }

  private ensureVisibilityListener(): void {
    if (this.boundVisibilityHandler) return;

    this.boundVisibilityHandler = () => {
      if (document.visibilityState === "visible" && this.wantLock) {
        void this.requestLock();
      }
    };
    this.boundPageShowHandler = () => {
      if (this.wantLock) {
        void this.requestLock();
      }
    };

    document.addEventListener("visibilitychange", this.boundVisibilityHandler);
    window.addEventListener("pageshow", this.boundPageShowHandler);
  }
}
