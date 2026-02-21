import type { LoadSpec, RepSpec } from "../types/contracts";

let idCounter = 0;
export function genId(): string {
  return `${Date.now()}-${++idCounter}`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function formatRepInput(r: RepSpec): string {
  switch (r.type) {
    case "fixed": return `${r.value}`;
    case "range": return `${r.min}-${r.max}`;
    case "toFailure": return "AMRAP";
    case "timed": return `${r.seconds}s`;
  }
}

export function formatLoadInput(l: LoadSpec): string {
  switch (l.type) {
    case "weight": return `${l.value}${l.unit}`;
    case "bodyweight": return "BW";
    case "rpe": return `RPE ${l.value}`;
    case "percentage": return `${l.value}%`;
    case "none": return "";
  }
}

export function parseRepInput(value: string): RepSpec {
  const v = value.trim();
  if (/^amrap$/i.test(v)) return { type: "toFailure" };

  const timedMatch = v.match(/^(\d+)s$/i);
  if (timedMatch) return { type: "timed", seconds: parseInt(timedMatch[1]!, 10) };

  const rangeMatch = v.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    return {
      type: "range",
      min: parseInt(rangeMatch[1]!, 10),
      max: parseInt(rangeMatch[2]!, 10),
    };
  }

  const fixed = parseInt(v, 10);
  if (!Number.isNaN(fixed)) return { type: "fixed", value: fixed };

  return { type: "fixed", value: 10 };
}

export function parseLoadInput(value: string): LoadSpec {
  const v = value.trim();
  if (!v) return { type: "none" };
  if (/^bw$/i.test(v) || /^bodyweight$/i.test(v)) return { type: "bodyweight" };

  const rpeMatch = v.match(/^rpe\s+(\d+(?:\.\d+)?)/i);
  if (rpeMatch) return { type: "rpe", value: parseFloat(rpeMatch[1]!) };

  const pctMatch = v.match(/^(\d+(?:\.\d+)?)%$/);
  if (pctMatch) return { type: "percentage", value: parseFloat(pctMatch[1]!) };

  const weightMatch = v.match(/^(\d+(?:\.\d+)?)\s*(kg|lb)$/i);
  if (weightMatch) {
    return {
      type: "weight",
      value: parseFloat(weightMatch[1]!),
      unit: weightMatch[2]!.toLowerCase() as "kg" | "lb",
    };
  }

  return { type: "none" };
}

export function getDatasetInt(value: string | undefined): number {
  return parseInt(value ?? "0", 10);
}

export function readEventValue(event: Event): string {
  const target = event.target as { value?: unknown } | null;
  if (!target || target.value === undefined || target.value === null) return "";
  if (Array.isArray(target.value)) return target.value.join(",");
  return String(target.value);
}

export function findActionElement(event: Event): HTMLElement | null {
  const path = event.composedPath();
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.dataset["action"]) return node;
  }
  return null;
}

export async function presentConfirmAlert(options: {
  header: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmRole?: string;
}): Promise<boolean> {
  const confirmRole = options.confirmRole ?? "confirm";

  return new Promise<boolean>((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "app-dialog-overlay";
    overlay.innerHTML = `<section class="app-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title">
      <h3 id="app-dialog-title">${esc(options.header)}</h3>
      <p>${esc(options.message)}</p>
      <div class="app-dialog-actions">
        <button type="button" class="btn btn-ghost" data-role="cancel">${esc(options.cancelText ?? "Cancel")}</button>
        <button type="button" class="btn btn-danger" data-role="${esc(confirmRole)}">${esc(options.confirmText ?? "Confirm")}</button>
      </div>
    </section>`;

    const cleanup = (confirmed: boolean): void => {
      overlay.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      overlay.classList.remove("is-open");
      window.setTimeout(() => {
        overlay.remove();
        resolve(confirmed);
      }, 120);
    };

    const onClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target === overlay) {
        cleanup(false);
        return;
      }
      const role = target.dataset["role"];
      if (!role) return;
      cleanup(role === confirmRole);
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        cleanup(false);
      }
    };

    overlay.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
    window.requestAnimationFrame(() => {
      overlay.classList.add("is-open");
    });
  });
}

function getToastHost(): HTMLElement {
  let host = document.getElementById("phone-toast-host");
  if (host) return host;

  host = document.createElement("div");
  host.id = "phone-toast-host";
  host.className = "toast-host";
  document.body.appendChild(host);
  return host;
}

export async function presentToast(message: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const host = getToastHost();
    const toast = document.createElement("div");
    toast.className = "app-toast";
    toast.textContent = message;

    host.appendChild(toast);
    window.requestAnimationFrame(() => {
      toast.classList.add("is-open");
    });

    window.setTimeout(() => {
      toast.classList.remove("is-open");
      window.setTimeout(() => {
        toast.remove();
        resolve();
      }, 180);
    }, 1200);
  });
}
