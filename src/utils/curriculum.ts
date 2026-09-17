import type { Course, Program } from "../types";
import { getCoursesByProgram } from "../services/catalog.service";

const TYPE_CLASS: Record<Course["type"], string> = {
  Obligatoria: "subject-type-obligatoria",
  Electiva: "subject-type-electiva",
  Práctica: "subject-type-practica",
  "Trabajo de grado": "subject-type-grado",
  Cátedra: "subject-type-catedra",
};

export function subjectCard(course: Course): string {
  return `<article class="pensum-subject-card ${TYPE_CLASS[course.type]}">
    <div class="pensum-subject-head">
      <span class="pensum-subject-code">${course.code}</span>
      <span class="pensum-subject-type">${course.type}</span>
    </div>
    <h4 class="pensum-subject-name">${course.name}</h4>
    <p class="pensum-subject-description">${course.description}</p>
    <div class="pensum-subject-meta">
      <span class="pensum-subject-meta-item"><b>${course.credits}</b><small>cr&eacute;ditos</small></span>
      <span class="pensum-subject-meta-item"><b>${course.hours}</b><small>h/semana</small></span>
    </div>
  </article>`;
}

export function semesterCard(semester: number, courses: Course[]): string {
  const credits = courses.reduce((acc, item) => acc + item.credits, 0);
  const hours = courses.reduce((acc, item) => acc + item.hours, 0);
  if (courses.length === 1) {
    return `<section class="pensum-semester-card">
      <header class="pensum-semester-header">
        <div class="pensum-semester-number">
          <span class="pensum-semester-num">${String(semester).padStart(2, "0")}</span>
          <span class="pensum-semester-label">Semestre</span>
        </div>
        <div class="pensum-semester-stats">
          <span><b>${courses.length}</b> materia</span>
          <span><b>${credits}</b> cr&eacute;ditos</span>
          <span><b>${hours}</b> h/sem</span>
        </div>
      </header>
      <div class="pensum-subjects-grid pensum-subjects-grid-single">
        ${courses.map(subjectCard).join("")}
      </div>
    </section>`;
  }
  return `<section class="pensum-semester-card">
    <header class="pensum-semester-header">
      <div class="pensum-semester-number">
        <span class="pensum-semester-num">${String(semester).padStart(2, "0")}</span>
        <span class="pensum-semester-label">Semestre</span>
      </div>
      <div class="pensum-semester-stats">
        <span><b>${courses.length}</b> materias</span>
        <span><b>${credits}</b> cr&eacute;ditos</span>
        <span><b>${hours}</b> h/sem</span>
      </div>
    </header>
    <div class="pensum-subjects-grid">
      ${courses.map(subjectCard).join("")}
    </div>
  </section>`;
}

export interface PensumCta {
  href: string;
  label: string;
}

export function renderCurriculumContent(program: Program, cta?: PensumCta): string {
  const courses = getCoursesByProgram(program.id);
  const semesters = [...new Set(courses.map((course) => course.semester))].sort(
    (a, b) => a - b,
  );
  const totalCredits = courses.reduce((acc, item) => acc + item.credits, 0);
  const totalHours = courses.reduce((acc, item) => acc + item.hours, 0);

  const summary = `
    <div class="pensum-summary">
      <div><b>${courses.length}</b><span>materias</span></div>
      <div><b>${semesters.length}</b><span>semestres</span></div>
      <div><b>${totalCredits}</b><span>cr&eacute;ditos</span></div>
      <div><b>${totalHours}</b><span>h/semana</span></div>
      <div><b>${program.modality}</b><span>modalidad</span></div>
    </div>`;

  const legend = `
    <div class="pensum-legend">
      <span class="pensum-legend-dot subject-type-obligatoria"></span>Obligatoria
      <span class="pensum-legend-dot subject-type-electiva"></span>Electiva
      <span class="pensum-legend-dot subject-type-practica"></span>Pr&aacute;ctica
      <span class="pensum-legend-dot subject-type-grado"></span>Trabajo de grado
      <span class="pensum-legend-dot subject-type-catedra"></span>C&aacute;tedra
    </div>`;

  const ctaHtml = cta
    ? `<div class="pensum-cta"><a class="primary-button" href="${cta.href}">${cta.label}</a></div>`
    : "";

  return `
    <section class="pensum-page">
      <header class="pensum-page-header">
        <span class="eyebrow">Pensum acad&eacute;mico &middot; ${program.level}</span>
        <h1>${program.name}</h1>
        <p class="pensum-page-subtitle">${program.modality} &middot; ${program.duration} &middot; ${program.description}</p>
      </header>
      ${summary}
      ${legend}
      <div class="pensum-semesters-list">
        ${semesters.map((semester) => semesterCard(semester, courses.filter((c) => c.semester === semester))).join("")}
      </div>
      ${ctaHtml}
    </section>`;
}
