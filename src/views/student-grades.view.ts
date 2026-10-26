import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { getPeriod } from "../services/catalog.service";
import { studentCourseDetails, type StudentCourseDetail } from "../services/assignments.service";
import { gradeAverage, graduationProgress, MIN_GRADE } from "../services/grades.service";
import { listByApplicant } from "../services/admissions.service";

function statusBadge(grade: number | undefined): string {
  if (grade === undefined) return `<span class="status-badge status-neutral">En curso</span>`;
  const approved = grade >= MIN_GRADE;
  return `<span class="status-badge ${approved ? "status-good" : "status-bad"}">${approved ? "Aprobada" : "Reprobada"}</span>`;
}

function taskRows(details: StudentCourseDetail): string {
  if (details.tasks.length === 0) {
    return `<p class="program-note">Esta materia a&uacute;n no tiene tareas registradas.</p>`;
  }
  return `<div class="table-scroll">
    <table class="data-table">
      <thead><tr><th>Tarea</th><th>Peso</th><th>Tu nota</th><th>Aporte a la final</th></tr></thead>
      <tbody>
        ${details.tasks
          .map(
            (task) => `<tr>
              <td><strong>${task.assignment.title}</strong>
                ${task.assignment.description ? `<br><small style="color:var(--muted-soft);">${task.assignment.description}</small>` : ""}
                ${task.assignment.dueDate ? `<br><small style="color:var(--muted-soft);">Entrega: ${new Date(task.assignment.dueDate).toLocaleDateString("es-CO")}</small>` : ""}
              </td>
              <td>${task.assignment.weight}%</td>
              <td>${task.value === undefined ? '<span style="color:var(--muted-soft);">Sin calificar</span>' : task.value.toFixed(1)}</td>
              <td>${task.value === undefined ? "—" : task.contribution.toFixed(2)}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

export function renderStudentGradesView(account: Account): void {
  const details = studentCourseDetails(account.id);
  const admission = listByApplicant(account.id).find((item) => item.status === "Admitido");
  const progress = admission ? graduationProgress(account.id, admission.programId) : undefined;

  const byPeriod = new Map<string, typeof details>();
  details.forEach((item) => {
    const list = byPeriod.get(item.periodId) ?? [];
    list.push(item);
    byPeriod.set(item.periodId, list);
  });

  const sections = [...byPeriod.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([periodId, items]) => {
      const period = getPeriod(periodId);
      const cards = items
        .map(
          (item) => `<article class="pensum-subject-card enrollment-card">
            <div class="pensum-subject-head">
              <span class="pensum-subject-code">${item.course?.code ?? ""}</span>
              ${statusBadge(item.finalGrade)}
            </div>
            <h4 class="pensum-subject-name">${item.course?.name ?? "Materia"}</h4>
            <p class="pensum-subject-description">${item.offering?.professor ?? "Docente por asignar"} &middot; ${item.course?.credits ?? 0} cr&eacute;ditos</p>
            <div class="pensum-subject-meta enrollment-meta">
              <span class="pensum-subject-meta-item"><b>${item.finalGrade === undefined ? "—" : item.finalGrade.toFixed(2)}</b><small>nota final</small></span>
              <span class="pensum-subject-meta-item"><b>${item.tasks.length}</b><small>tareas</small></span>
              <span class="pensum-subject-meta-item"><b>${item.weightTotal}%</b><small>peso asignado</small></span>
              ${item.pendingTasks > 0 ? `<span class="pensum-subject-meta-item"><b>${item.pendingTasks}</b><small>sin calificar</small></span>` : ""}
            </div>
            <div style="margin-top:14px;">${taskRows(item)}</div>
          </article>`,
        )
        .join("");
      return `<section class="pensum-semester-card">
        <header class="pensum-semester-header">
          <div class="pensum-semester-number">
            <span class="pensum-semester-num">${period?.name ?? periodId}</span>
            <span class="pensum-semester-label">Periodo</span>
          </div>
          <div class="pensum-semester-stats">
            <span><b>${items.length}</b> materias</span>
          </div>
        </header>
        <div class="pensum-subjects-grid">${cards}</div>
      </section>`;
    })
    .join("");

  const average = gradeAverage(account.id);
  const failed = details.filter((item) => item.approved === false);

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Notas</span>
          <h1>Mis calificaciones</h1>
          <p>Cada tarea aporta un porcentaje a la nota final de la materia. Tu nota final es el promedio ponderado de tus tareas, y al cambiarla se actualizan tu promedio y tu avance al grado.</p>
        </div>
      </div>
      <div class="pensum-summary">
        <div><b>${average.toFixed(2)}</b><span>promedio ponderado</span></div>
        <div><b>${progress?.approvedCourses ?? 0}</b><span>materias aprobadas</span></div>
        <div><b>${progress?.failedCourses ?? 0}</b><span>materias reprobadas</span></div>
        <div><b>${progress?.earnedCredits ?? 0}</b><span>cr&eacute;ditos ganados</span></div>
        <div><b>${progress?.percent ?? 0}%</b><span>avance al grado</span></div>
      </div>
      ${
        failed.length > 0
          ? `<div class="form-message error" style="margin-bottom:18px;">
              Reprobaste ${failed.length} materia(s): ${failed.map((f) => f.course?.code ?? "").join(", ")}. Debes repetirlas para avanzar; sus prerrequisitos seguir&aacute;n bloqueados.
            </div>`
          : ""
      }
      ${sections || `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;text-align:center;"><div><span class="pensum-semester-label">A&uacute;n no tienes materias matriculadas.</span></div></div></div>`}
    </section>`,
    "Mis calificaciones",
    account,
  );
}
