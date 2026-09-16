import type { Account } from "../types";
import { badgeClassForStatus, renderShell } from "../utils/dom";
import { decide, listAll, markUnderReview } from "../services/admissions.service";
import { getProgram } from "../services/catalog.service";

export function renderAdminView(account: Account): void {
  const applications = listAll();

  const rows = applications
    .map((item) => {
      const program = getProgram(item.programId);
      const canAct = item.status === "Radicada" || item.status === "En revisión";
      const actions = canAct
        ? `<div class="admin-actions">${
            item.status === "Radicada"
              ? `<button class="secondary-button" data-action="review" data-id="${item.id}" type="button">Marcar en revisión</button>`
              : ""
          }<button class="primary-button" data-action="approve" data-id="${item.id}" type="button">Admitir</button><button class="outline-button-dark" data-action="reject" data-id="${item.id}" type="button">Rechazar</button></div>`
        : `<span class="program-note">${item.reviewNote ?? "Sin comentarios"}</span>`;
      return `<tr><td>${item.id}</td><td>${item.applicantEmail}</td><td>${program?.name ?? item.programId}</td><td><span class="${badgeClassForStatus(item.status)}">${item.status}</span></td><td>${new Date(item.createdAt).toLocaleDateString("es-CO")}</td><td>${actions}</td></tr>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Staff de admisiones</span><h1>Panel de solicitudes</h1><p>Revisa y decide sobre las solicitudes de admisión recibidas.</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Radicado</th><th>Correo</th><th>Programa</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No hay solicitudes registradas.</td></tr>'}</tbody></table></div></section>`,
    "Panel de admisiones",
    account,
  );

  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      const action = button.dataset.action;
      if (action === "review") markUnderReview(id);
      if (action === "approve") decide(id, "Admitido", "Cumple los requisitos de admisión.");
      if (action === "reject") decide(id, "Rechazado", "No cumple los requisitos en este periodo.");
      renderAdminView(account);
    });
  });
}
