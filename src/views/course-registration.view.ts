import type { Account } from "../types";
import { renderShell, setFormMessage } from "../utils/dom";
import {
  getActivePeriod,
  getCourse,
  getCoursesByProgram,
  getOfferingsByPeriod,
  getProgram,
} from "../services/catalog.service";
import {
  MAX_CREDITS_PER_PERIOD,
  availableSeats,
  cancel,
  creditsInUse,
  enroll,
  getActiveEnrollments,
} from "../services/enrollment.service";
import { listByApplicant } from "../services/admissions.service";

export function renderRegistrationView(account: Account): void {
  const period = getActivePeriod();
  const admission = listByApplicant(account.id).find((item) => item.status === "Admitido");

  if (!period || !admission) {
    renderShell(
      `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Matrícula</span><h1>Aún no puedes matricular materias</h1><p>${
        !admission
          ? "No encontramos una admisión aprobada asociada a tu cuenta."
          : "No hay un periodo académico activo en este momento."
      }</p></div></div></section>`,
      "Matrícula",
      account,
    );
    return;
  }

  const program = getProgram(admission.programId);
  const programCourses = getCoursesByProgram(admission.programId);
  const courseIds = new Set(programCourses.map((item) => item.id));
  const offerings = getOfferingsByPeriod(period.id).filter((item) => courseIds.has(item.courseId));
  const enrolled = getActiveEnrollments(account.id, period.id);
  const enrolledOfferingIds = new Set(enrolled.map((item) => item.offeringId));
  const usedCredits = creditsInUse(account.id, period.id);

  const catalogRows = offerings
    .map((offering) => {
      const course = getCourse(offering.courseId);
      if (!course) return "";
      const seats = availableSeats(offering);
      const isEnrolled = enrolledOfferingIds.has(offering.id);
      const actionCell = isEnrolled
        ? '<span class="program-note">Matriculada</span>'
        : `<button class="enroll-button" data-offering="${offering.id}" type="button" ${
            seats <= 0 ? "disabled" : ""
          }>${seats <= 0 ? "Sin cupo" : "Matricular"}</button>`;
      return `<tr><td>${course.name}</td><td>${course.credits}</td><td>${offering.day}, ${offering.startTime}–${offering.endTime}</td><td>${offering.professor}</td><td>${seats}/${offering.capacity}</td><td>${actionCell}</td></tr>`;
    })
    .join("");

  const enrolledRows = enrolled
    .map((item) => {
      const offering = offerings.find((entry) => entry.id === item.offeringId);
      const course = offering ? getCourse(offering.courseId) : undefined;
      if (!offering || !course) return "";
      return `<tr><td>${course.name}</td><td>${course.credits}</td><td>${offering.day}, ${offering.startTime}–${offering.endTime}</td><td><button class="outline-button-dark" data-cancel="${item.id}" type="button">Cancelar</button></td></tr>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Periodo ${period.name}</span><h1>Matrícula de materias</h1><p>Programa: ${program?.name ?? admission.programId}. Créditos usados: <strong>${usedCredits}/${MAX_CREDITS_PER_PERIOD}</strong>.</p></div></div><div id="form-message" class="form-message"></div><h2 class="table-title">Mi matrícula actual</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Materia</th><th>Créditos</th><th>Horario</th><th></th></tr></thead><tbody>${
      enrolledRows || '<tr><td colspan="4">Aún no has matriculado materias este periodo.</td></tr>'
    }</tbody></table></div><h2 class="table-title">Oferta académica disponible</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>Materia</th><th>Créditos</th><th>Horario</th><th>Docente</th><th>Cupos</th><th></th></tr></thead><tbody>${
      catalogRows || '<tr><td colspan="6">No hay oferta académica publicada para tu programa en este periodo.</td></tr>'
    }</tbody></table></div></section>`,
    "Matrícula",
    account,
  );

  document.querySelectorAll<HTMLButtonElement>("[data-offering]").forEach((button) => {
    button.addEventListener("click", () => {
      const offeringId = button.dataset.offering;
      if (!offeringId) return;
      const result = enroll(account.id, offeringId);
      if (!result.ok) {
        setFormMessage(result.message, "error");
        return;
      }
      renderRegistrationView(account);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const enrollmentId = button.dataset.cancel;
      if (!enrollmentId) return;
      cancel(enrollmentId);
      renderRegistrationView(account);
    });
  });
}
