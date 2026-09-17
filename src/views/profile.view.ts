import type { Account, AdmissionApplication } from "../types";
import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { getAccounts, updateAccount } from "../services/auth.service";
import { getProgram } from "../services/catalog.service";
import { listByApplicant } from "../services/admissions.service";
import {
  creditsInUse,
  getActiveEnrollments,
  getEnrollmentHistory,
  MAX_CREDITS_PER_PERIOD,
} from "../services/enrollment.service";
import { getActivePeriod } from "../services/catalog.service";
import { listProgramChangesByStudent } from "../services/program-changes.service";

function admissionStatusClass(status: string): string {
  if (status === "Admitido") return "status-badge status-good";
  if (status === "Rechazado") return "status-badge status-bad";
  if (status === "En revisión") return "status-badge status-warn";
  return "status-badge status-neutral";
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function academicInfo(account: Account): string {
  const period = getActivePeriod();
  const usedCredits = period ? creditsInUse(account.id, period.id) : 0;
  const activeEnrollments = period ? getActiveEnrollments(account.id, period.id) : [];
  const history = getEnrollmentHistory(account.id);
  const completedEnrollments = history.filter((item) => item.status === "Matriculada");
  const completedCredits = completedEnrollments.length; // approximation
  const semesterNumber = completedCredits > 0 ? Math.min(10, Math.floor(completedCredits / 4) + 1) : 1;

  return `<section class="profile-section">
    <header class="profile-section-header">
      <span class="eyebrow">Información académica</span>
      <h2>Tu progreso en la UNAC</h2>
    </header>
    <div class="profile-stats">
      <article><b>${semesterNumber}</b><span>semestre actual</span></article>
      <article><b>${usedCredits}/${MAX_CREDITS_PER_PERIOD}</b><span>cr&eacute;ditos este periodo</span></article>
      <article><b>${activeEnrollments.length}</b><span>materias matriculadas</span></article>
      <article><b>${completedEnrollments.length}</b><span>materias cursadas</span></article>
    </div>
    ${account.role === "Estudiante" ? `<div class="profile-quicklinks">
      <a class="profile-link" href="#registration"><span class="profile-icon">&#128218;</span><span><b>Matricular materias</b><small>Selecciona las materias para este periodo</small></span><span>&rarr;</span></a>
      <a class="profile-link" href="#history"><span class="profile-icon">&#128200;</span><span><b>Historial acad&eacute;mico</b><small>Consulta las materias cursadas</small></span><span>&rarr;</span></a>
      <a class="profile-link" href="#pensum/${account.role === "Estudiante" ? "" : ""}"><span class="profile-icon">&#128218;</span><span><b>Pensum acad&eacute;mico</b><small>${account.role === "Estudiante" ? "Ver el programa que estás cursando" : "Explorar programas"}</small></span><span>&rarr;</span></a>
    </div>` : ""}
  </section>`;
}

function careerInfo(account: Account, admission: AdmissionApplication | undefined): string {
  if (!admission) {
    return account.role === "Aspirante"
      ? `<section class="profile-section">
          <header class="profile-section-header">
            <span class="eyebrow">Programa</span>
            <h2>Aún no tienes un programa asignado</h2>
          </header>
          <p>Cuando completes el proceso de admisi&oacute;n podr&aacute;s ver aqu&iacute; los detalles del programa al que aspiras.</p>
          <div class="profile-quicklinks">
            <a class="profile-link" href="#enrollment"><span class="profile-icon">&#128221;</span><span><b>Radicar solicitud de admisi&oacute;n</b><small>Inicia tu proceso acad&eacute;mico</small></span><span>&rarr;</span></a>
          </div>
        </section>`
      : "";
  }
  const program = getProgram(admission.programId);
  const changes = listProgramChangesByStudent(account.id);
  const latestChange = changes[0];

  return `<section class="profile-section">
    <header class="profile-section-header">
      <span class="eyebrow">Programa acad&eacute;mico</span>
      <h2>${program?.name ?? "Programa"}</h2>
    </header>
    <div class="profile-grid-2">
      <div class="profile-info-card">
        <span class="profile-info-label">Carrera</span>
        <strong>${program?.name ?? "—"}</strong>
        <small>${program?.level ?? ""} &middot; ${program?.duration ?? ""} &middot; ${program?.modality ?? ""}</small>
      </div>
      <div class="profile-info-card">
        <span class="profile-info-label">Estado de admisi&oacute;n</span>
        <strong><span class="${admissionStatusClass(admission.status)}">${admission.status}</span></strong>
        <small>Solicitud ${admission.id} &middot; ${formatDate(admission.createdAt)}</small>
      </div>
    </div>
    ${account.role === "Estudiante" && program ? `<div class="profile-quicklinks">
      <a class="profile-link" href="#pensum/${program.id}"><span class="profile-icon">&#128218;</span><span><b>Ver pensum completo</b><small>${program.name}</small></span><span>&rarr;</span></a>
      <a class="profile-link" href="#program-change"><span class="profile-icon">&#128260;</span><span><b>Solicitar cambio de carrera</b><small>${latestChange ? `Última solicitud: ${latestChange.status}` : "Si tus metas cambiaron, solicita un cambio"}</small></span><span>&rarr;</span></a>
      <a class="profile-link" href="#prerequisites"><span class="profile-icon">&#127891;</span><span><b>Declarar prerrequisitos</b><small>Homologa materias cursadas en otras instituciones</small></span><span>&rarr;</span></a>
    </div>` : ""}
  </section>`;
}

export function renderProfileView(account: Account): void {
  const admission = listByApplicant(account.id)[0];

  renderShell(
    `<section class="profile-card">
      <div class="profile-header">
        <div>
          <span class="eyebrow">Cuenta</span>
          <h1>${account.firstName} ${account.lastName}</h1>
          <p>${account.role === "Aspirante" ? "Aspirante" : account.role === "Estudiante" ? "Estudiante UNAC" : "Equipo de admisiones"} &middot; Miembro desde ${formatDate(account.createdAt)}</p>
        </div>
        <span class="role-badge">${account.role}</span>
      </div>
      ${careerInfo(account, admission)}
      ${account.role === "Estudiante" ? academicInfo(account) : ""}
      <section class="profile-section">
        <header class="profile-section-header">
          <span class="eyebrow">Datos personales</span>
          <h2>Tu informaci&oacute;n de contacto</h2>
        </header>
        <form id="profile-form" class="profile-form">
          <div class="profile-edit-grid">
            <label>Nombre<input name="firstName" value="${account.firstName}" required><small class="field-error"></small></label>
            <label>Apellidos<input name="lastName" value="${account.lastName}" required><small class="field-error"></small></label>
            <label>Tel&eacute;fono<input name="phone" value="${account.phone}" required><small class="field-error"></small></label>
            <div class="profile-field locked"><span>Correo electr&oacute;nico</span><strong>${account.email}</strong><small>Dato no modificable</small></div>
            <div class="profile-field locked"><span>Documento</span><strong>${account.documentType} ${account.documentNumber}</strong><small>Dato no modificable</small></div>
            <div class="profile-field locked"><span>Rol</span><strong>${account.role}</strong><small>Asignado por el equipo de admisiones</small></div>
          </div>
          <div id="form-message" class="form-message"></div>
          <div class="profile-footer"><p>Tu informaci&oacute;n personal solo est&aacute; disponible para tu cuenta.</p><a class="secondary-button" href="#home">Cancelar</a><button class="primary-button profile-save" type="submit">Guardar cambios</button></div>
        </form>
      </section>
    </section>`,
    "Mi perfil",
    account,
  );

  const form = document.querySelector<HTMLFormElement>("#profile-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const names = ["firstName", "lastName", "phone"];
    let valid = true;
    names.forEach((name) => {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(field, text);
      valid = valid && !text;
    });
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }
    const data = new FormData(form);
    const updated = updateAccount(account.id, {
      firstName: String(data.get("firstName")).trim(),
      lastName: String(data.get("lastName")).trim(),
      phone: String(data.get("phone")).trim(),
    });
    const refreshed = updated ?? getAccounts().find((item) => item.id === account.id);
    if (refreshed) renderProfileView(refreshed);
    setFormMessage("Tus datos se actualizaron correctamente.", "success");
  });
}
