import type { PhoneStatusState } from "../types";
import { badgeClass, cardClass, cardContentClass, textClass } from "../designSystem";
import { esc } from "../utils";

function statusLabel(state: PhoneStatusState["state"]): string {
  if (state === "connected") return "CONNECTED";
  if (state === "error") return "ERROR";
  return "CONNECTING";
}

export function renderStatusView(status: PhoneStatusState): string {
  const showSpinner = status.state === "connecting";
  const statusClass = status.state === "error"
    ? "status-badge-error"
    : status.state === "connected"
      ? "status-badge-connected"
      : "status-badge-connecting";

  return `<main class="phone-screen status-view">
    <section class="${cardClass("status-panel")}">
      <div class="${cardContentClass("status-panel-content")}">
      <p class="${textClass("detail", "screen-kicker")}">Fitness HUD</p>
      <div class="${badgeClass(`status-badge ${statusClass}`)}">${statusLabel(status.state)}</div>
      ${showSpinner ? "<div class=\"status-spinner\" aria-hidden=\"true\"></div>" : ""}
      <h1 id="status-text" class="${textClass("title-lg", "status-title")}">${esc(status.text)}</h1>
      ${status.detail ? `<p id="status-detail" class="${textClass("body-2", "status-detail")}">${esc(status.detail)}</p>` : ""}
      </div>
    </section>
  </main>`;
}
