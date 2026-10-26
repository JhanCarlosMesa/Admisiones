import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { listActiveNotificationsFor, markReadFor } from "../services/notifications.service";

function iconFor(type: string): string {
  if (type === "warning") return "&#9888;";
  if (type === "success") return "&#10003;";
  if (type === "danger") return "&#10005;";
  return "&#8505;";
}

export function renderNotificationsView(account: Account): void {
  const list = listActiveNotificationsFor(account.role, account.id).filter(
    (n) => !(n.audience === account.id && n.readAt),
  );

  const items = list.length
    ? list
        .map(
          (n) => `
        <article class="notification-item notification-${n.type}">
          <span class="notification-icon" aria-hidden="true">${iconFor(n.type)}</span>
          <div>
            <strong>${n.title}</strong>
            <span>${n.body}</span>
            <small class="notification-date">${new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</small>
          </div>
        </article>`,
        )
        .join("")
    : `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;text-align:center;"><div><span class="pensum-semester-label">No tienes notificaciones por ahora.</span></div></div></div>`;

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Notificaciones</span>
          <h1>Bandeja de notificaciones</h1>
          <p>Aqu&iacute; recibes los avisos de cada etapa de tu proceso: admisi&oacute;n, matr&iacute;cula, homologaciones y lista de espera.</p>
        </div>
      </div>
      ${items}
      ${list.length ? '<div class="form-footer"><button id="mark-read" type="button">Marcar todas como le&iacute;das</button></div>' : ""}
    </section>`,
    "Notificaciones",
    account,
  );

  document.querySelector<HTMLButtonElement>("#mark-read")?.addEventListener("click", () => {
    markReadFor(account.id);
    renderNotificationsView(account);
  });
}
