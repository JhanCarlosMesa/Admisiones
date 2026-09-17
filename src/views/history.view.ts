import type { Account, Course } from "../types";
import { badgeClassForStatus, renderShell } from "../utils/dom";
import { getEnrollmentHistory } from "../services/enrollment.service";
import { getCourse, getOffering, getPeriod } from "../services/catalog.service";

const TYPE_CLASS: Record<Course["type"], string> = {
  Obligatoria: "subject-type-obligatoria",
  Electiva: "subject-type-electiva",
  Práctica: "subject-type-practica",
  "Trabajo de grado": "subject-type-grado",
  Cátedra: "subject-type-catedra",
};

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
      const cards = records
        .map((item) => {
          const offering = getOffering(item.offeringId);
          const course = offering ? getCourse(offering.courseId) : undefined;
          if (!course) return "";
          const statusClass = badgeClassForStatus(item.status);
          return `<article class="pensum-subject-card enrollment-card ${TYPE_CLASS[course.type]}">
            <div class="pensum-subject-head">
              <span class="pensum-subject-code">${course.code}</span>
              <span class="pensum-subject-type">${course.type}</span>
              <span class="${statusClass}">${item.status}</span>
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
          <p>Consulta las materias que has cursado en cada periodo acad&eacute;mico, con sus cr&eacute;ditos y calificaciones.</p>
        </div>
      </div>
      ${sections || `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;"><div><span class="pensum-semester-label">A&uacute;n no tienes materias matriculadas en periodos anteriores.</span></div></div></div>`}
    </section>`,
    "Historial académico",
    account,
  );
}
