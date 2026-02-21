import { DEFAULTS, STORAGE_KEYS } from "../config/constants";
import type {
  StorageAdapter,
  TrainingPlan,
  WeightUnit,
  WorkoutLog,
  WorkoutSession,
} from "../types/contracts";

export class StorageAdapterImpl implements StorageAdapter {
  loadPlans(): TrainingPlan[] {
    return this.loadJson<TrainingPlan[]>(STORAGE_KEYS.plans) ?? [];
  }

  savePlan(plan: TrainingPlan): void {
    const plans = this.loadPlans();
    const idx = plans.findIndex((p) => p.id === plan.id);
    if (idx >= 0) {
      plans[idx] = plan;
    } else {
      plans.push(plan);
    }
    this.saveJson(STORAGE_KEYS.plans, plans);
  }

  deletePlan(planId: string): void {
    const plans = this.loadPlans().filter((p) => p.id !== planId);
    this.saveJson(STORAGE_KEYS.plans, plans);
  }

  loadSession(): WorkoutSession | null {
    return this.loadJson<WorkoutSession>(STORAGE_KEYS.session);
  }

  saveSession(session: WorkoutSession): void {
    this.saveJson(STORAGE_KEYS.session, session);
  }

  clearSession(): void {
    this.removeKey(STORAGE_KEYS.session);
  }

  loadLogs(): WorkoutLog[] {
    return this.loadJson<WorkoutLog[]>(STORAGE_KEYS.logs) ?? [];
  }

  saveLog(log: WorkoutLog): void {
    const logs = this.loadLogs();
    logs.push(log);
    this.saveJson(STORAGE_KEYS.logs, logs);
  }

  clearLogs(): void {
    this.removeKey(STORAGE_KEYS.logs);
  }

  loadUnitPreference(): WeightUnit {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.unitPreference);
      if (val === "lb") return "lb";
    } catch {
      // best effort
    }
    return DEFAULTS.unit;
  }

  saveUnitPreference(unit: WeightUnit): void {
    try {
      localStorage.setItem(STORAGE_KEYS.unitPreference, unit);
    } catch {
      // best effort
    }
  }

  private loadJson<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private saveJson(key: string, data: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      console.warn(`[storage] Failed to save ${key}`);
    }
  }

  private removeKey(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // best effort
    }
  }
}
