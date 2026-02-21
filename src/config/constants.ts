export const DISPLAY = {
  WIDTH: 576,
  HEIGHT: 288,
} as const;

export const GLASS_LAYOUT = {
  x: 8,
  y: 4,
  textWidth: 560,
  textHeight: 196,
  actionY: 204,
  actionWidth: 560,
  actionHeight: 80,
  listFullHeight: 272,
} as const;

export const TEXT_LAYOUT = {
  CHARS_PER_LINE: 64,
  LINES_PER_PAGE: 7,
} as const;

export const TIMING = {
  SCROLL_COOLDOWN_MS: 300,
  BRIDGE_TIMEOUT_MS: 15_000,
  TIMER_TICK_MS: 250,
} as const;

export const CONTAINER_IDS = {
  text: 1,
  action: 2,
} as const;

export const CONTAINER_NAMES = {
  text: "txtin",
  action: "actls",
} as const;

export const ACTION_LABELS = {
  done: "\u2713 Done",
  skip: "Skip",
  skipRest: "Skip Rest",
  dismiss: "Done",
} as const;

export const STORAGE_KEYS = {
  plans: "g2gym.plans",
  session: "g2gym.session",
  logs: "g2gym.logs",
  unitPreference: "g2gym.unit",
} as const;

export const DEFAULTS = {
  restBetweenExercises: 0,
  restBetweenRounds: 60,
  restAfterBlock: 90,
  rounds: 1,
  unit: "kg" as const,
} as const;
