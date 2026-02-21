import type { PhoneStatusState } from "../types";
import { esc } from "../utils";

function statusLabel(state: PhoneStatusState["state"]): string {
  if (state === "connected") return "CONNECTED";
  if (state === "error") return "ERROR";
  return "CONNECTING";
}

export function renderStatusView(status: PhoneStatusState): string {
  const showSpinner = status.state === "connecting";

  return `<main class="phone-screen status-view">
    <section class="panel status-panel">
      <p class="screen-kicker">Fitness HUD</p>
      <div class="status-pill status-${status.state}">${statusLabel(status.state)}</div>
      ${showSpinner ? "<div class=\"status-spinner\" aria-hidden=\"true\"></div>" : ""}
      <h1 id="status-text" class="status-title">${esc(status.text)}</h1>
      ${status.detail ? `<p id="status-detail" class="status-detail">${esc(status.detail)}</p>` : ""}
    </section>
  </main>`;
}
