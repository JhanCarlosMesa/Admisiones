import type { Account, Course, CourseOffering } from "../types";
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

const TYPE_CLASS: Record<Course["type"], string> = {
  Obligatoria: "subject-type-obligatoria",
  Electiva: "subject-type-electiva",
  Práctica: "subject-type-practica",
  "Trabajo de grado": "subject-type-grado",
  Cátedra: "subject-type-catedra",
};

function enrolledCard(offering: CourseOffering | undefined, enrollmentId: string, course: Course | undefined): string {
  if (!offering || !course) return "";
  return `<article class="pensum-subject-card enrollment-card ${TYPE_CLASS[course.type]}">
    <div class="pensum-subject-head">
      <span class="pensum-subject-code">${course.code}</span>
      <span class="pensum-subject-type">${course.type}</span>
      <span class="status-badge status-good">Matriculada</span>
    </div>
    <h4 class="pensum-subject-name">${course.name}</h4>
    <p class="pensum-subject-description">${course.description}</p>
    <div class="pensum-subject-meta enrollment-meta">
      <span class="pensum-subject-meta-item"><b>${course.credits}</b><small>cr&eacute;ditos</small></span>
      <span class="pensum-subject-meta-item"><b>${course.hours}</b><small>h/semana</small></span>
      <span class="pensum-subject-meta-item"><b>${offering.day}</b><small>${offering.startTime}&ndash;${offering.endTime}</small></span>
    </div>
    <div class="enrollment-actions">
      <button class="outline-button-dark" data-cancel="${enrollmentId}" type="button">Cancelar materia</button>
    </div>
  </article>`;
}

function offeringCard(
  offering: CourseOffering,
  course: Course,
  isEnrolled: boolean,
  seats: number,
): string {
  const actionCell = isEnrolled
    ? `<span class="status-badge status-good">Matriculada</span>`
    : seats <= 0
      ? `<span class="status-badge status-bad">Sin cupo</span>`
      : `<button class="enroll-button" data-offering="${offering.id}" type="button">Matricular &rarr;</button>`;
  return `<article class="pensum-subject-card enrollment-card ${TYPE_CLASS[course.type]}">
    <div class="pensum-subject-head">
      <span class="pensum-subject-code">${course.code}</span>
      <span class="pensum-subject-type">${course.type}</span>
      ${seats <= 0 ? `<span class="status-badge status-warn">${seats}/${offering.capacity} cupos</span>` : `<span class="status-badge status-neutral">${seats}/${offering.capacity} cupos</span>`}
    </div>
    <h4 class="pensum-subject-name">${course.name}</h4>
    <p class="pensum-subject-description">${course.description}</p>
    <div class="pensum-subject-meta enrollment-meta">
      <span class="pensum-subject-meta-item"><b>${course.credits}</b><small>cr&eacute;ditos</small></span>
      <span class="pensum-subject-meta-item"><b>${course.hours}</b><small>h/semana</small></span>
      <span class="pensum-subject-meta-item"><b>${offering.day}</b><small>${offering.startTime}&ndash;${offering.endTime}</small></span>
      <span class="pensum-subject-meta-item"><b>${offering.professor}</b><small>docente</small></span>
    </div>
    <div class="enrollment-actions">
      ${actionCell}
    </div>
  </article>`;
}

function semesterSection(
  semester: number,
  offerings: Array<{ offering: CourseOffering; course: Course }>,
  enrolledIds: Set<string>,
): string {
  const credits = offerings.reduce((sum, o) => sum + o.course.credits, 0);
  const hours = offerings.reduce((sum, o) => sum + o.course.hours, 0);
  return `<section class="pensum-semester-card">
    <header class="pensum-semester-header">
      <div class="pensum-semester-number">
        <span class="pensum-semester-num">${String(semester).padStart(2, "0")}</span>
        <span class="pensum-semester-label">Semestre</span>
      </div>
      <div class="pensum-semester-stats">
        <span><b>${offerings.length}</b> materias</span>
        <span><b>${credits}</b> cr&eacute;ditos</span>
        <span><b>${hours}</b> h/sem</span>
      </div>
    </header>
    <div class="pensum-subjects-grid">
      ${offerings.map(({ offering, course }) => offeringCard(offering, course, enrolledIds.has(offering.id), availableSeats(offering))).join("")}
    </div>
  </section>`;
}

export function renderRegistrationView(account: Account): void {
  const period = getActivePeriod();
  const admission = listByApplicant(account.id).find((item) => item.status === "Admitido");

  if (!period || !admission) {
    renderShell(
      `<section class="enrollment-card"><div class="enrollment-header"><div><span class="eyebrow">Matr&iacute;cula</span><h1>A&uacute;n no puedes matricular materias</h1><p>${
        !admission
          ? "No encontramos una admisi&oacute;n aprobada asociada a tu cuenta."
          : "No hay un periodo acad&eacute;mico activo en este momento."
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

  // Group offerings by semester, using the course's semester field
  const offeringsByCourse = new Map(offerings.map((o) => [o.courseId, o]));
  const groupedBySemester = new Map<number, Array<{ offering: CourseOffering; course: Course }>>();
  for (const course of programCourses) {
    const offering = offeringsByCourse.get(course.id);
    if (!offering) continue;
    const arr = groupedBySemester.get(course.semester) ?? [];
    arr.push({ offering, course });
    groupedBySemester.set(course.semester, arr);
  }
  const semesters = [...groupedBySemester.keys()].sort((a, b) => a - b);

  const enrolledHtml = enrolled.length === 0
    ? `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center; padding:32px; text-align:center;"><div><span class="pensum-semester-label">A&uacute;n no has matriculado materias este periodo</span></div></div></div>`
    : `<section class="pensum-semester-card">
        <header class="pensum-semester-header">
          <div class="pensum-semester-number">
            <span class="pensum-semester-num" style="background:linear-gradient(135deg,#1c7249,#145e3b);">${enrolled.length}</span>
            <span class="pensum-semester-label">Matriculadas</span>
          </div>
          <div class="pensum-semester-stats">
            <span><b>${usedCredits}</b> / ${MAX_CREDITS_PER_PERIOD} cr&eacute;ditos</span>
          </div>
        </header>
        <div class="pensum-subjects-grid">
          ${enrolled
            .map((item) => {
              const offering = offerings.find((o) => o.id === item.offeringId);
              const course = offering ? getCourse(offering.courseId) : undefined;
              return enrolledCard(offering, item.id, course);
            })
            .join("")}
        </div>
      </section>`;

  const catalogHtml = semesters.length === 0
    ? `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center; padding:32px; text-align:center;"><div><span class="pensum-semester-label">No hay oferta acad&eacute;mica publicada para tu programa en este periodo.</span></div></div></div>`
    : semesters
        .map((semester) =>
          semesterSection(
            semester,
            groupedBySemester.get(semester) ?? [],
            enrolledOfferingIds,
          ),
        )
        .join("");

  const summaryHtml = `
    <div class="pensum-summary">
      <div><b>${enrolled.length}</b><span>matriculadas</span></div>
      <div><b>${usedCredits}/${MAX_CREDITS_PER_PERIOD}</b><span>cr&eacute;ditos</span></div>
      <div><b>${semesters.length}</b><span>semestres</span></div>
      <div><b>${offerings.length}</b><span>materias oferta</span></div>
      <div><b>${period.name}</b><span>periodo activo</span></div>
    </div>`;
  const legendHtml = `
    <div class="pensum-legend">
      <span class="pensum-legend-dot subject-type-obligatoria"></span>Obligatoria
      <span class="pensum-legend-dot subject-type-electiva"></span>Electiva
      <span class="pensum-legend-dot subject-type-practica"></span>Pr&aacute;ctica
      <span class="pensum-legend-dot subject-type-grado"></span>Trabajo de grado
      <span class="pensum-legend-dot subject-type-catedra"></span>C&aacute;tedra
    </div>`;

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Matr&iacute;cula &middot; Periodo ${period.name}</span>
          <h1>Matr&iacute;cula de materias</h1>
          <p>Programa: <strong>${program?.name ?? admission.programId}</strong>. L&iacute;mite por periodo: ${MAX_CREDITS_PER_PERIOD} cr&eacute;ditos. Elige las materias que cursar&aacute;s este semestre.</p>
        </div>
      </div>
      <div id="form-message" class="form-message"></div>
      <h2 class="pensum-section-title">Mi matr&iacute;cula actual</h2>
      ${enrolledHtml}
      <h2 class="pensum-section-title">Oferta acad&eacute;mica &middot; Pensum de ${program?.name ?? "tu programa"}</h2>
      ${summaryHtml}
      ${legendHtml}
      <div class="pensum-semesters-list">${catalogHtml}</div>
    </section>`,
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
