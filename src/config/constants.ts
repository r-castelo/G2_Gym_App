export const DISPLAY = {
  WIDTH: 576,
  HEIGHT: 288,
} as const;

export const GLASS_LAYOUT = {
  x: 8,
  y: 4,
  textWidth: 560,
  textHeight: 196,
  textHeightWithFooter: 216, // Reduced to make room for taller footer
  footerX: 196,
  footerY: 228,              // Shifted up
  footerWidth: 372,
  footerHeight: 48,          // Increased to prevent clipping
  footerPadding: 6,
  actionY: 204,
  actionWidth: 560,
  actionHeight: 80,
  actionXWithFooter: 8,
  actionYWithFooter: 228,    // Shifted up
  actionWidthWithFooter: 180,
  actionHeightWithFooter: 48, // Increased to prevent clipping
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
  footer: 3,
} as const;

export const CONTAINER_NAMES = {
  text: "txtin",
  action: "actls",
  footer: "fttxt",
} as const;

export const ACTION_LABELS = {
  done: "Done",
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
  restBetweenExercises: 60,
  restBetweenRounds: 60,
  restAfterBlock: 90,
  rounds: 1,
  unit: "kg" as const,
} as const;
