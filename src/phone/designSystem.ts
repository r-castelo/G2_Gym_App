export type ButtonVariant = "default" | "accent" | "primary" | "negative";
export type ButtonSize = "sm" | "md" | "lg";
export type TextVariant =
  | "title-xl"
  | "title-lg"
  | "title-1"
  | "body-1"
  | "title-2"
  | "body-2"
  | "subtitle"
  | "detail";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-8 rounded-sm border border-transparent text-app-body-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-bc-1 disabled:pointer-events-none";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  default: "bg-bc-1 text-tc-1 active:bg-bc-3 disabled:bg-bc-1 disabled:text-tc-2",
  accent: "bg-bc-accent text-tc-1 active:bg-bc-accent-pressed disabled:bg-bc-accent-muted disabled:text-tc-2",
  primary: "bg-bc-highlight text-tc-highlight active:bg-bc-highlight active:text-tc-highlight-pressed disabled:bg-bc-3 disabled:text-tc-highlight",
  negative: "bg-bc-1 text-tc-red active:bg-bc-3 active:text-tc-red disabled:bg-bc-1 disabled:text-tc-red",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-28 px-12 text-app-body-2",
  md: "h-32 px-16 text-app-body-1",
  lg: "h-40 px-20 text-app-title-2",
};

const TEXT_VARIANT: Record<TextVariant, string> = {
  "title-xl": "text-app-title-xl",
  "title-lg": "text-app-title-lg",
  "title-1": "text-app-title-1",
  "body-1": "text-app-body-1",
  "title-2": "text-app-title-2",
  "body-2": "text-app-body-2",
  subtitle: "text-app-subtitle",
  detail: "text-app-detail",
};

export function buttonClass(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className);
}

export function textClass(variant: TextVariant = "body-1", className?: string): string {
  return cx(TEXT_VARIANT[variant], "text-tc-1", className);
}

export function cardClass(className?: string): string {
  return cx("rounded-md border border-bc-4 bg-bc-1 shadow-1", className);
}

export function cardHeaderClass(className?: string): string {
  return cx("border-b border-bc-3 px-16 py-12", className);
}

export function cardContentClass(className?: string): string {
  return cx("px-16 py-12", className);
}

export function cardFooterClass(className?: string): string {
  return cx("border-t border-bc-3 px-16 py-12", className);
}

export function inputClass(className?: string): string {
  return cx(
    "flex h-32 w-full rounded-sm border border-bc-4 bg-bc-1 px-12 text-app-body-2 text-tc-1 placeholder:text-tc-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-bc-1 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

export function selectClass(className?: string): string {
  return cx(
    "flex h-32 w-full appearance-none rounded-sm border border-bc-4 bg-bc-1 px-12 text-app-body-2 text-tc-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-bc-1 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

export function textareaClass(className?: string): string {
  return cx(
    "flex min-h-32 w-full resize-y rounded-sm border border-bc-4 bg-bc-1 px-12 py-8 text-app-body-2 text-tc-1 placeholder:text-tc-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bc-highlight focus-visible:ring-offset-2 focus-visible:ring-offset-bc-1 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );
}

export function badgeClass(className?: string): string {
  return cx(
    "inline-flex items-center rounded-sm border border-bc-3 bg-bc-2 px-8 py-4 text-app-detail text-tc-1",
    className,
  );
}
