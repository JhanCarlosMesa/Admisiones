import type { Account } from "../types";
import { renderShell, setFieldError, setFormMessage } from "../utils/dom";
import { listPrerequisitesByStudent, createPrerequisite } from "../services/prerequisites.service";

function field(label: string, name: string, type: string, required = true): string {
  return `<label>${label}<input name="${name}" type="${type}" ${required ? "required" : ""} ${type === "number" ? 'step="0.1" min="0" max="5"' : ""}><small class="field-error"></small></label>`;
}

function statusBadgeClass(status: string): string {
  if (status === "Aprobada") return "status-badge status-good";
  if (status === "Rechazada") return "status-badge status-bad";
  return "status-badge status-neutral";
}

const CURRENT_YEAR = new Date().getFullYear();

export function renderPrerequisitesView(account: Account): void {
  const records = listPrerequisitesByStudent(account.id);

  const historyHtml = records.length === 0
    ? `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;"><div><span class="pensum-semester-label">A&uacute;n no has declarado prerrequisitos externos.</span></div></div></div>`
    : `<div class="pensum-semesters-list">${records
        .map((item) => `
          <article class="pensum-subject-card">
            <div class="pensum-subject-head">
              <span class="pensum-subject-code">${item.courseCode}</span>
              <span class="${statusBadgeClass(item.status)}">${item.status}</span>
            </div>
            <h4 class="pensum-subject-name">${item.courseName}</h4>
            <p class="pensum-subject-description">${item.institution} &middot; ${item.year} &middot; Nota final: <strong>${item.grade.toFixed(1)}</strong>${item.notes ? `<br>${item.notes}` : ""}</p>
            <div class="pensum-subject-meta enrollment-meta">
              <span class="pensum-subject-meta-item"><b>${new Date(item.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}</b><small>declarado</small></span>
              ${item.reviewedAt ? `<span class="pensum-subject-meta-item"><b>${new Date(item.reviewedAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}</b><small>revisado</small></span>` : ""}
              ${item.reviewNote ? `<span class="pensum-subject-meta-item"><b>"${item.reviewNote}"</b><small>nota</small></span>` : ""}
            </div>
          </article>
        `)
        .join("")}</div>`;

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Prerrequisitos</span>
          <h1>Homologaciones y prerrequisitos externos</h1>
          <p>Si aprobaste materias en otra instituci&oacute;n y deseas que sean evaluadas para homologaci&oacute;n, declara cada una a continuaci&oacute;n. El equipo acad&eacute;mico revisar&aacute; la informaci&oacute;n y emitir&aacute; una respuesta.</p>
        </div>
      </div>
      <form id="prerequisites-form" novalidate>
        <div class="form-grid">
          ${field("C&oacute;digo de la materia", "courseCode", "text")}
          ${field("Nombre de la materia", "courseName", "text")}
          ${field("Instituci&oacute;n", "institution", "text")}
          ${field("A&ntilde;o de aprobaci&oacute;n", "year", "number")}
          ${field("Nota final (0.0 - 5.0)", "grade", "number")}
        </div>
        <label class="wide-label" style="margin-top:18px">Observaciones<textarea name="notes" placeholder="Detalla el contenido, intensidad horaria o cualquier informaci&oacute;n que consideres relevante para la evaluaci&oacute;n."></textarea><small class="field-error"></small></label>
        <div id="form-message" class="form-message"></div>
        <div class="form-footer">
          <p>La homologaci&oacute;n definitiva se publicar&aacute; en tu historial acad&eacute;mico una vez aprobada.</p>
          <button type="submit">Declarar prerrequisito &rarr;</button>
        </div>
      </form>
      <h2 class="pensum-section-title">Mis declaraciones</h2>
      ${historyHtml}
    </section>`,
    "Prerrequisitos",
    account,
  );

  const form = document.querySelector<HTMLFormElement>("#prerequisites-form");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const courseCode = String(data.get("courseCode") ?? "").trim();
    const courseName = String(data.get("courseName") ?? "").trim();
    const institution = String(data.get("institution") ?? "").trim();
    const year = Number(data.get("year") ?? 0);
    const grade = Number(data.get("grade") ?? 0);
    const notes = String(data.get("notes") ?? "").trim();

    let valid = true;
    ["courseCode", "courseName", "institution"].forEach((name) => {
      const field = form.elements.namedItem(name) as HTMLInputElement;
      const text = field.value.trim() ? "" : "Este campo es obligatorio.";
      setFieldError(field, text);
      valid = valid && !text;
    });
    const yearField = form.elements.namedItem("year") as HTMLInputElement;
    if (!year || year < 1990 || year > CURRENT_YEAR) {
      setFieldError(yearField, `Ingresa un a&ntilde;o entre 1990 y ${CURRENT_YEAR}.`);
      valid = false;
    }
    const gradeField = form.elements.namedItem("grade") as HTMLInputElement;
    if (grade < 0 || grade > 5) {
      setFieldError(gradeField, "La nota debe estar entre 0.0 y 5.0.");
      valid = false;
    }
    if (!valid) {
      setFormMessage("Revisa los campos marcados.", "error");
      return;
    }

    createPrerequisite({
      studentId: account.id,
      studentEmail: account.email,
      studentName: `${account.firstName} ${account.lastName}`,
      courseCode,
      courseName,
      institution,
      year,
      grade,
      notes: notes || undefined,
    });
    setFormMessage("Prerrequisito declarado. Te avisaremos cuando sea evaluado.", "success");
    setTimeout(() => renderPrerequisitesView(account), 600);
  });
}
