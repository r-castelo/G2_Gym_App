import "./phone/phone.css";

import { Controller } from "./app/controller";
import { GlassAdapterImpl } from "./adapters/glassAdapter";
import { StorageAdapterImpl } from "./adapters/storageAdapter";
import { WakeLockServiceImpl } from "./services/wakeLockService";
import { PhoneUI, setPhoneState } from "./phone/phoneUI";

async function bootstrap(): Promise<void> {
  setPhoneState("connecting", "Connecting to glasses...", "Open this page from Even App dev mode");

  const glass = new GlassAdapterImpl();
  const storage = new StorageAdapterImpl();
  const wakeLock = new WakeLockServiceImpl();

  let phoneUI: PhoneUI | null = null;

  const controller = new Controller({
    glass,
    storage,
    wakeLock,
    onSessionChange: (session) => {
      phoneUI?.onSessionUpdate(session);
    },
  });

  phoneUI = new PhoneUI({
    storage,
    onStartWorkout: (planId) => {
      controller.startWorkout(planId).catch((err: unknown) => {
        console.error("Failed to start workout:", err);
        setPhoneState("error", "Failed to start workout", String(err));
      });
    },
    onAbandonWorkout: () => {
      controller.abandonWorkout().catch((err: unknown) => {
        console.error("Failed to abandon workout:", err);
      });
    },
  });

  await controller.start();

  setPhoneState("connected", "Connected to glasses");
  phoneUI.show();

  // If there's an active session, phone UI will pick it up via onSessionChange
}

void bootstrap().catch((error: unknown) => {
  setPhoneState("error", "Failed to start", String(error));
  console.error("G2 Gym Trainer failed to start", error);
});
