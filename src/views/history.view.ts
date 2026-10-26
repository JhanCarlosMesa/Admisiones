import type { Account, Course, Enrollment } from "../types";
import { badgeClassForStatus, renderShell } from "../utils/dom";
import { getEnrollmentHistory } from "../services/enrollment.service";
import { getCourse, getOffering, getPeriod } from "../services/catalog.service";
import { graduationProgress, listGradedCourses, MIN_GRADE } from "../services/grades.service";
import { listByApplicant } from "../services/admissions.service";

const TYPE_CLASS: Record<Course["type"], string> = {
  Obligatoria: "subject-type-obligatoria",
  Electiva: "subject-type-electiva",
  Práctica: "subject-type-practica",
  "Trabajo de grado": "subject-type-grado",
  Cátedra: "subject-type-catedra",
};

function gradeBadge(grade: number | undefined): string {
  if (grade === undefined) return `<span class="status-badge status-neutral">Sin nota</span>`;
  const approved = grade >= MIN_GRADE;
  return `<span class="status-badge ${approved ? "status-good" : "status-bad"}">Nota ${grade.toFixed(1)}</span>`;
}

/** Estado mostrado: si hay nota, manda el resultado académico sobre el de matrícula. */
function statusBadge(enrollment: Enrollment): string {
  if (enrollment.grade !== undefined) {
    const approved = enrollment.grade >= MIN_GRADE;
    return `<span class="status-badge ${approved ? "status-good" : "status-bad"}">${approved ? "Aprobada" : "Reprobada"}</span>`;
  }
  return `<span class="${badgeClassForStatus(enrollment.status)}">${enrollment.status}</span>`;
}

function progressPanel(account: Account): string {
  const admission = listByApplicant(account.id).find((item) => item.status === "Admitido");
  if (!admission) return "";
  const progress = graduationProgress(account.id, admission.programId);
  const graded = listGradedCourses(account.id);

  const approvedCredits = progress.earnedCredits;
  const percent = progress.percent;
  const pendingList = progress.pendingRequired
    .slice(0, 6)
    .map(
      (course) =>
        `<li><span class="pensum-subject-code">${course.code}</span> ${course.name} <small>${course.credits} cr&eacute;ditos</small></li>`,
    )
    .join("");

  return `<section class="pensum-semester-card">
    <header class="pensum-semester-header">
      <div class="pensum-semester-number">
        <span class="pensum-semester-num">${percent}%</span>
        <span class="pensum-semester-label">Avance al grado</span>
      </div>
      <div class="pensum-semester-stats">
        <span><b>${approvedCredits}</b> / ${progress.totalCredits} cr&eacute;ditos</span>
        <span><b>${progress.average.toFixed(2)}</b> promedio</span>
        <span><b>${graded.length}</b> materias calificadas</span>
      </div>
    </header>
    <div class="pensum-subject-description" style="padding:0 22px 18px;">
      <div class="progress-bar"><span style="width:${percent}%;"></span></div>
      ${
        progress.canGraduate
          ? `<p style="margin-top:12px;color:var(--green-700);font-weight:700;">Cumples el 100% de los cr&eacute;ditos del pensum. Ya puedes solicitar tu grado.</p>`
          : `<p style="margin-top:12px;">Te faltan <strong>${progress.pendingCredits} cr&eacute;ditos</strong> por aprobar. ${
              progress.pendingRequired.length > 0
                ? `Materias obligatorias pendientes: ${progress.pendingRequired.length}.`
                : ""
            }</p>`
      }
      ${
        progress.pendingRequired.length > 0
          ? `<ul class="pending-list">${pendingList}${progress.pendingRequired.length > 6 ? `<li><em>y ${progress.pendingRequired.length - 6} m&aacute;s...</em></li>` : ""}</ul>`
          : ""
      }
      ${
        progress.failedCourses > 0
          ? `<p style="margin-top:10px;color:var(--red-700);">Has reprobado ${progress.failedCourses} materia(s). Debes repetirlas para avanzar.</p>`
          : ""
      }
    </div>
  </section>`;
}

export function renderHistoryView(account: Account): void {
  const history = getEnrollmentHistory(account.id);

  const periodIds = [...new Set(history.map((item) => item.periodId))];
  const sections = periodIds
    .map((periodId) => {
      const period = getPeriod(periodId);
      const records = history.filter((item) => item.periodId === periodId);
      const credits = records.reduce((sum, item) => {
        const offering = getOffering(item.offeringId);
        const course = offering ? getCourse(offering.courseId) : undefined;
        return sum + (course?.credits ?? 0);
      }, 0);
      const graded = records.filter((item: Enrollment) => item.grade !== undefined);
      const average = graded.length
        ? graded.reduce((sum, item) => sum + (item.grade ?? 0), 0) / graded.length
        : 0;
      const cards = records
        .map((item) => {
          const offering = getOffering(item.offeringId);
          const course = offering ? getCourse(offering.courseId) : undefined;
          if (!course) return "";
          return `<article class="pensum-subject-card enrollment-card ${TYPE_CLASS[course.type]}">
            <div class="pensum-subject-head">
              <span class="pensum-subject-code">${course.code}</span>
              <span class="pensum-subject-type">${course.type}</span>
              ${statusBadge(item)}
              ${gradeBadge(item.grade)}
            </div>
            <h4 class="pensum-subject-name">${course.name}</h4>
            <p class="pensum-subject-description">${course.description}</p>
            <div class="pensum-subject-meta enrollment-meta">
              <span class="pensum-subject-meta-item"><b>${course.credits}</b><small>cr&eacute;ditos</small></span>
              <span class="pensum-subject-meta-item"><b>${course.hours}</b><small>h/semana</small></span>
              ${offering ? `<span class="pensum-subject-meta-item"><b>${offering.day}</b><small>${offering.startTime}&ndash;${offering.endTime}</small></span>` : ""}
              ${offering ? `<span class="pensum-subject-meta-item"><b>${offering.professor}</b><small>docente</small></span>` : ""}
            </div>
          </article>`;
        })
        .join("");
      return `<section class="pensum-semester-card">
        <header class="pensum-semester-header">
          <div class="pensum-semester-number">
            <span class="pensum-semester-num">${period?.name ?? periodId}</span>
            <span class="pensum-semester-label">Periodo</span>
          </div>
          <div class="pensum-semester-stats">
            <span><b>${records.length}</b> materias</span>
            <span><b>${credits}</b> cr&eacute;ditos</span>
            ${graded.length ? `<span><b>${average.toFixed(2)}</b> promedio</span>` : ""}
          </div>
        </header>
        <div class="pensum-subjects-grid">${cards}</div>
      </section>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Historial</span>
          <h1>Historial acad&eacute;mico</h1>
          <p>Consulta las materias que has cursado en cada periodo acad&eacute;mico, con sus cr&eacute;ditos, calificaciones y tu avance hacia el grado.</p>
        </div>
      </div>
      ${progressPanel(account)}
      ${sections || `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;"><div><span class="pensum-semester-label">A&uacute;n no tienes materias matriculadas en periodos anteriores.</span></div></div></div>`}
    </section>`,
    "Historial académico",
    account,
  );
}
