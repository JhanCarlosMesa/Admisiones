import type { Account } from "../types";
import { badgeClassForStatus, renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { listByApplicant, submitApplication } from "../services/admissions.service";
import { getPrograms, getProgram } from "../services/catalog.service";
import { STORAGE_KEYS } from "../data/keys";

function selectField(label: string, name: string, options: string[]): string {
  return `<label>${label}<select name="${name}" required><option value="">Selecciona una opción</option>${options
    .map((option) => `<option>${option}</option>`)
    .join("")}</select><small class="field-error"></small></label>`;
}

function renderTracking(account: Account): void {
  const applications = listByApplicant(account.id);
  const rows = applications
    .map((item) => {
      const program = getProgram(item.programId);
      return `<tr><td>${item.id}</td><td>${program?.name ?? item.programId}</td><td><span class="${badgeClassForStatus(item.status)}">${item.status}</span></td><td>${new Date(item.createdAt).toLocaleDateString("es-CO")}</td><td>${item.reviewNote ?? "—"}</td></tr>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Seguimiento</span><h1>Tu solicitud de admisión</h1><p>Aquí puedes ver el estado de tu(s) solicitud(es).</p></div></div><div class="table-scroll"><table class="data-table"><thead><tr><th>Radicado</th><th>Programa</th><th>Estado</th><th>Fecha</th><th>Nota</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-note">Cuando tu solicitud sea marcada como <strong>Admitido</strong>, tu cuenta pasará automáticamente a rol Estudiante y podrás matricular materias.</p></section>`,
    "Mi solicitud",
    account,
  );
}

function renderForm(account: Account): void {
  const programs = getPrograms();
  const pendingProgramId = sessionStorage.getItem(STORAGE_KEYS.pendingProgram) ?? "";
  if (pendingProgramId) sessionStorage.removeItem(STORAGE_KEYS.pendingProgram);
  const prefillNote = pendingProgramId
    ? `<p class="prefill-note">&#10003; Preseleccionamos el programa que elegiste al registrarte. Puedes cambiarlo si lo deseas.</p>`
    : "";

  renderShell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Nueva solicitud</span><h1>Inicia tu inscripción</h1><p>Completa la información para comenzar tu proceso de admisión.</p>${prefillNote}</div><span class="step-badge">Paso 1 de 3</span></div><form id="application-form" class="enrollment-form" novalidate><div class="section-heading"><span>01</span><div><h2>Elige tu programa</h2><p>Selecciona la opción académica.</p></div></div><div class="form-grid"><label>Programa académico<select name="programId" required><option value="">Selecciona una opción</option>${programs
      .map(
        (program) =>
          `<option value="${program.id}" ${program.id === pendingProgramId ? "selected" : ""}>${program.name}</option>`,
      )
      .join("")}</select><small class="field-error"></small></label>${selectField("Nivel académico", "level", ["Pregrado", "Posgrado"])}<label>Ciudad de residencia<input name="city" required><small class="field-error"></small></label>${selectField("Modalidad", "modality", ["Presencial", "Virtual"])}</div><div class="section-heading credentials-heading"><span>02</span><div><h2>Cuéntanos sobre ti</h2><p>Esta información nos ayuda a conocerte.</p></div></div><label class="wide-label">Motivación<textarea name="motivation" rows="4" required></textarea><small class="field-error"></small></label><div id="form-message" class="form-message"></div><div class="enrollment-footer"><a class="secondary-button" href="#home">Cancelar</a><button class="primary-button" type="submit">Crear solicitud &rarr;</button></div></form></section>`,
    "Iniciar inscripción",
    account,
  );

  const form = document.querySelector<HTMLFormElement>("#application-form")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const names = ["programId", "level", "city", "modality", "motivation"];
    let valid = true;
    names.forEach((name) => {
      const field = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement;
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(field, text);
      valid = valid && !text;
    });
    if (!valid) {
      setFormMessage("Revisa los campos marcados para continuar.", "error");
      return;
    }
    const result = submitApplication(account, {
      programId: String(data.get("programId")),
      level: String(data.get("level")),
      city: String(data.get("city")),
      modality: String(data.get("modality")),
      motivation: String(data.get("motivation")),
    });
    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    renderTracking(account);
  });
}

export function renderApplicationView(account: Account): void {
  const applications = listByApplicant(account.id);
  const hasActive = applications.some((item) => item.status !== "Rechazado");
  if (hasActive) renderTracking(account);
  else renderForm(account);
}
