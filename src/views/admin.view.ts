import type { Account } from "../types";
import { badgeClassForStatus, renderShell } from "../utils/dom";
import { decide, listAll, markUnderReview } from "../services/admissions.service";
import { getProgram } from "../services/catalog.service";
import { listAllProgramChanges, updateProgramChangeStatus } from "../services/program-changes.service";
import { listAllPrerequisites, updatePrerequisiteStatus } from "../services/prerequisites.service";

function admissionCard(_account: Account): string {
  const applications = listAll();
  const rows = applications
    .map((item) => {
      const program = getProgram(item.programId);
      const canAct = item.status === "Radicada" || item.status === "En revisión";
      const actions = canAct
        ? `<div class="admin-actions">${
            item.status === "Radicada"
              ? `<button class="secondary-button" data-admission-action="review" data-id="${item.id}" type="button">Marcar en revisi&oacute;n</button>`
              : ""
          }<button class="primary-button" data-admission-action="approve" data-id="${item.id}" type="button">Admitir</button><button class="outline-button-dark" data-admission-action="reject" data-id="${item.id}" type="button">Rechazar</button></div>`
        : `<span class="program-note">${item.reviewNote ?? "Sin comentarios"}</span>`;
      return `<tr><td>${item.id}</td><td>${item.applicantEmail}</td><td>${program?.name ?? item.programId}</td><td><span class="${badgeClassForStatus(item.status)}">${item.status}</span></td><td>${new Date(item.createdAt).toLocaleDateString("es-CO")}</td><td>${actions}</td></tr>`;
    })
    .join("");

  return `<section class="profile-section">
    <header class="profile-section-header">
      <span class="eyebrow">Solicitudes de admisi&oacute;n</span>
      <h2>Decisiones pendientes</h2>
    </header>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Radicado</th><th>Correo</th><th>Programa</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No hay solicitudes registradas.</td></tr>'}</tbody></table></div>
  </section>`;
}

function programChangesCard(): string {
  const requests = listAllProgramChanges();
  const pending = requests.filter((item) => item.status === "Solicitada" || item.status === "En revisión");
  const history = requests.filter((item) => item.status === "Aprobada" || item.status === "Rechazada");

  const renderRow = (item: typeof requests[number], isPending: boolean): string => {
    const cur = getProgram(item.currentProgramId);
    const req = getProgram(item.requestedProgramId);
    const actions = isPending
      ? `<div class="admin-actions"><button class="primary-button" data-change-action="approve" data-id="${item.id}" type="button">Aprobar</button><button class="outline-button-dark" data-change-action="reject" data-id="${item.id}" type="button">Rechazar</button></div>`
      : `<span class="program-note">${item.reviewNote ?? "—"}</span>`;
    return `<tr><td>${item.id}</td><td>${item.studentName}<br><small>${item.studentEmail}</small></td><td>${cur?.name ?? item.currentProgramId} &rarr; ${req?.name ?? item.requestedProgramId}</td><td><span class="status-badge ${item.status === "Aprobada" ? "status-good" : item.status === "Rechazada" ? "status-bad" : item.status === "En revisión" ? "status-warn" : "status-neutral"}">${item.status}</span></td><td>${item.reason}</td><td>${actions}</td></tr>`;
  };

  return `<section class="profile-section">
    <header class="profile-section-header">
      <span class="eyebrow">Cambios de carrera</span>
      <h2>Solicitudes de cambio de programa</h2>
    </header>
    ${pending.length === 0 ? `<p class="program-note" style="margin-bottom:16px">No hay solicitudes pendientes.</p>` : `<div class="table-scroll" style="margin-bottom:16px"><table class="data-table"><thead><tr><th>ID</th><th>Estudiante</th><th>Cambio</th><th>Estado</th><th>Motivo</th><th>Acciones</th></tr></thead><tbody>${pending.map((item) => renderRow(item, true)).join("")}</tbody></table></div>`}
    ${history.length === 0 ? "" : `<details class="admin-details"><summary>Historial (${history.length})</summary><div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>ID</th><th>Estudiante</th><th>Cambio</th><th>Estado</th><th>Motivo</th><th>Respuesta</th></tr></thead><tbody>${history.map((item) => renderRow(item, false)).join("")}</tbody></table></div></details>`}
  </section>`;
}

function prerequisitesCard(): string {
  const records = listAllPrerequisites();
  const pending = records.filter((item) => item.status === "Pendiente");
  const history = records.filter((item) => item.status !== "Pendiente");

  const renderRow = (item: typeof records[number], isPending: boolean): string => {
    const actions = isPending
      ? `<div class="admin-actions"><button class="primary-button" data-prereq-action="approve" data-id="${item.id}" type="button">Aprobar</button><button class="outline-button-dark" data-prereq-action="reject" data-id="${item.id}" type="button">Rechazar</button></div>`
      : `<span class="program-note">${item.reviewNote ?? "—"}</span>`;
    return `<tr><td>${item.id}</td><td>${item.studentName}<br><small>${item.studentEmail}</small></td><td>${item.courseCode} &middot; ${item.courseName}</td><td>${item.institution} &middot; ${item.year}</td><td>${item.grade.toFixed(1)}</td><td><span class="status-badge ${item.status === "Aprobada" ? "status-good" : "status-bad"}">${item.status}</span></td><td>${actions}</td></tr>`;
  };

  return `<section class="profile-section">
    <header class="profile-section-header">
      <span class="eyebrow">Prerrequisitos externos</span>
      <h2>Homologaciones pendientes</h2>
    </header>
    ${pending.length === 0 ? `<p class="program-note" style="margin-bottom:16px">No hay declaraciones pendientes.</p>` : `<div class="table-scroll" style="margin-bottom:16px"><table class="data-table"><thead><tr><th>ID</th><th>Estudiante</th><th>Materia</th><th>Instituci&oacute;n</th><th>Nota</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${pending.map((item) => renderRow(item, true)).join("")}</tbody></table></div>`}
    ${history.length === 0 ? "" : `<details class="admin-details"><summary>Historial (${history.length})</summary><div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>ID</th><th>Estudiante</th><th>Materia</th><th>Instituci&oacute;n</th><th>Nota</th><th>Estado</th><th>Respuesta</th></tr></thead><tbody>${history.map((item) => renderRow(item, false)).join("")}</tbody></table></div></details>`}
  </section>`;
}

export function renderAdminView(account: Account): void {
  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Staff de admisiones</span>
          <h1>Panel de control</h1>
          <p>Gestiona solicitudes de admisi&oacute;n, cambios de carrera y declaraciones de prerrequisitos.</p>
        </div>
      </div>
      ${admissionCard(account)}
      ${programChangesCard()}
      ${prerequisitesCard()}
    </section>`,
    "Panel de admisiones",
    account,
  );

  document.querySelectorAll<HTMLButtonElement>("[data-admission-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      const action = button.dataset.admissionAction;
      if (action === "review") markUnderReview(id);
      if (action === "approve") decide(id, "Admitido", "Cumple los requisitos de admisión.");
      if (action === "reject") decide(id, "Rechazado", "No cumple los requisitos en este periodo.");
      renderAdminView(account);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-change-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      const action = button.dataset.changeAction;
      if (action === "approve") updateProgramChangeStatus(id, "Aprobada", "Cambio aprobado tras evaluaci&oacute;n acad&eacute;mica.");
      if (action === "reject") updateProgramChangeStatus(id, "Rechazada", "El cambio no procede en este momento. Contacta al equipo de admisiones para m&aacute;s informaci&oacute;n.");
      renderAdminView(account);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-prereq-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (!id) return;
      const action = button.dataset.prereqAction;
      if (action === "approve") updatePrerequisiteStatus(id, "Aprobada", "Homologaci&oacute;n aprobada tras revisi&oacute;n.");
      if (action === "reject") updatePrerequisiteStatus(id, "Rechazada", "No se aprob&oacute; la homologaci&oacute;n. Verifica los cr&eacute;ditos y contenidos.");
      renderAdminView(account);
    });
  });
}
