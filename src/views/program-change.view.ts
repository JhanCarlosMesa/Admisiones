import type { Account } from "../types";
import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { getProgram, getPrograms } from "../services/catalog.service";
import { listByApplicant } from "../services/admissions.service";
import {
  createProgramChangeRequest,
  hasPendingProgramChange,
  listProgramChangesByStudent,
} from "../services/program-changes.service";

function field(label: string, name: string, type: string, required = true): string {
  return `<label>${label}<input name="${name}" type="${type}" ${required ? "required" : ""}><small class="field-error"></small></label>`;
}

function selectField(label: string, name: string, options: string[]): string {
  return `<label>${label}<select name="${name}" required><option value="">Selecciona una opción</option>${options
    .map((option) => `<option>${option}</option>`)
    .join("")}</select><small class="field-error"></small></label>`;
}

function statusBadgeClass(status: string): string {
  if (status === "Aprobada") return "status-badge status-good";
  if (status === "Rechazada") return "status-badge status-bad";
  if (status === "En revisión") return "status-badge status-warn";
  return "status-badge status-neutral";
}

export function renderProgramChangeView(account: Account): void {
  const admission = listByApplicant(account.id).find((item) => item.status === "Admitido");
  if (!admission) {
    renderShell(
      `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Cambio de carrera</span><h1>Aún no puedes solicitar un cambio</h1><p>Necesitas tener una admisión aprobada para iniciar un proceso de cambio de carrera.</p></div></div><div class="enrollment-footer"><a class="secondary-button" href="#profile">Volver a mi perfil</a></div></section>`,
      "Cambio de carrera",
      account,
    );
    return;
  }

  const currentProgram = getProgram(admission.programId);
  const programs = getPrograms().filter((p) => p.id !== admission.programId);
  const history = listProgramChangesByStudent(account.id);
  const pending = hasPendingProgramChange(account.id);

  const historyHtml = history.length === 0
    ? `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;"><div><span class="pensum-semester-label">A&uacute;n no has solicitado cambios de carrera.</span></div></div></div>`
    : `<div class="pensum-semesters-list">${history
        .map((item) => {
          const cur = getProgram(item.currentProgramId);
          const req = getProgram(item.requestedProgramId);
          const reviewed = item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" }) : "—";
          return `<article class="pensum-subject-card">
            <div class="pensum-subject-head">
              <span class="status-badge" style="background:rgba(15,53,104,.08);color:var(--navy-800);font-family:ui-monospace,monospace;font-size:12.5px;font-weight:700;padding:5px 10px;border-radius:6px;">${item.id}</span>
              <span class="${statusBadgeClass(item.status)}">${item.status}</span>
            </div>
            <h4 class="pensum-subject-name">${cur?.name ?? item.currentProgramId} &rarr; ${req?.name ?? item.requestedProgramId}</h4>
            <p class="pensum-subject-description">${item.reason}</p>
            <div class="pensum-subject-meta enrollment-meta">
              <span class="pensum-subject-meta-item"><b>${new Date(item.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}</b><small>solicitud</small></span>
              <span class="pensum-subject-meta-item"><b>${reviewed}</b><small>revisi&oacute;n</small></span>
              ${item.reviewNote ? `<span class="pensum-subject-meta-item"><b>"${item.reviewNote}"</b><small>nota</small></span>` : ""}
            </div>
          </article>`;
        })
        .join("")}</div>`;

  const formHtml = pending
    ? `<div class="recovery-notice"><b>Tienes una solicitud en tr&aacute;mite.</b> No puedes enviar una nueva hasta que el equipo de admisiones resuelva la anterior. Te avisaremos por correo cuando haya una respuesta.</div>`
    : `<form id="program-change-form" novalidate><div class="form-grid">${selectField(
        "Nueva carrera a la que deseas cambiar",
        "requestedProgramId",
        programs.map((p) => p.name),
      )}${field("Tu cohorte actual", "cohort", "text", false)}</div><label class="wide-label" style="margin-top:18px">Motivo del cambio<textarea name="reason" required minlength="40" placeholder="Explica brevemente por qu&eacute; deseas cambiar de carrera y c&oacute;mo se relaciona con tus metas acad&eacute;micas y profesionales..."></textarea><small class="field-error"></small></label><div id="form-message" class="form-message"></div><div class="form-footer"><p>Tu solicitud ser&aacute; revisada por el equipo de admisiones. La respuesta se publica en este mismo lugar.</p><button type="submit">Enviar solicitud &rarr;</button></div></form>`;

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Cambio de carrera</span>
          <h1>Solicitar cambio de programa</h1>
          <p>Programa actual: <strong>${currentProgram?.name ?? admission.programId}</strong>. Si consideras que otra carrera se ajusta mejor a tus metas, puedes solicitar un cambio. El equipo de admisiones evaluar&aacute; tu caso.</p>
        </div>
      </div>
      ${formHtml}
      <h2 class="pensum-section-title">Historial de solicitudes</h2>
      ${historyHtml}
    </section>`,
    "Cambio de carrera",
    account,
  );

  const form = document.querySelector<HTMLFormElement>("#program-change-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const requestedName = String(data.get("requestedProgramId") ?? "");
    const requested = programs.find((p) => p.name === requestedName);
    const reason = String(data.get("reason") ?? "").trim();

    let valid = true;
    if (!requestedName) {
      const field = form.elements.namedItem("requestedProgramId") as HTMLSelectElement;
      setFieldError(field, "Selecciona la carrera a la que quieres cambiar.");
      valid = false;
    }
    if (reason.length < 40) {
      const ta = form.elements.namedItem("reason") as HTMLTextAreaElement;
      setFieldError(ta, "Cu&eacute;ntanos un poco m&aacute;s (m&iacute;nimo 40 caracteres).");
      valid = false;
    }
    if (!valid) {
      setFormMessage("Revisa los campos marcados.", "error");
      return;
    }

    if (!requested) return;
    createProgramChangeRequest({
      studentId: account.id,
      studentEmail: account.email,
      studentName: `${account.firstName} ${account.lastName}`,
      currentProgramId: admission.programId,
      requestedProgramId: requested.id,
      reason,
    });
    setFormMessage("Tu solicitud fue radicada. Te avisaremos por correo cuando sea revisada.", "success");
    setTimeout(() => renderProgramChangeView(account), 600);
  });
}
