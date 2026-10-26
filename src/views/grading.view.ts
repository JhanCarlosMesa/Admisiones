import type { Account, CourseOffering } from "../types";
import { renderShell, setFormMessage } from "../utils/dom";
import { getAccounts } from "../services/auth.service";
import { getCourse, getOffering, getPeriod, getProgram, getPrograms } from "../services/catalog.service";
import { listAll as listAllApplications } from "../services/admissions.service";
import { cancel, enroll, listAllEnrollments } from "../services/enrollment.service";
import { MAX_GRADE, clearGrade, recordGrade } from "../services/grades.service";
import {
  clearAssignmentGrade,
  createAssignment,
  deleteAssignment,
  gradingSheet,
  notifyFinalGrade,
  recalculateFinalGrade,
  setAssignmentGrade,
  updateAssignment,
  type CourseGradingSheet,
} from "../services/assignments.service";

function offeringLabel(offering: CourseOffering): string {
  const course = getCourse(offering.courseId);
  const program = getProgram(course?.programId ?? "");
  const enrolled = listAllEnrollments().filter(
    (item) => item.offeringId === offering.id && item.status !== "Cancelada",
  ).length;
  return `${course?.code ?? ""} · ${course?.name ?? "Materia"} — ${program?.name ?? ""} (${enrolled} inscritos)`;
}

function courseOptions(selectedId: string | undefined): string {
  const enrollments = listAllEnrollments().filter((item) => item.status !== "Cancelada");
  const offeringIds = [...new Set(enrollments.map((item) => item.offeringId))];
  const offerings = offeringIds
    .map((id) => getOffering(id))
    .filter((offering): offering is CourseOffering => Boolean(offering));

  return getPrograms()
    .map((program) => {
      const options = offerings
        .filter((offering) => getCourse(offering.courseId)?.programId === program.id)
        .sort((a, b) => offeringLabel(a).localeCompare(offeringLabel(b)))
        .map(
          (offering) =>
            `<option value="${offering.id}"${offering.id === selectedId ? " selected" : ""}>${offeringLabel(offering)}</option>`,
        )
        .join("");
      return options ? `<optgroup label="${program.name}">${options}</optgroup>` : "";
    })
    .join("");
}

function summaryHtml(sheet: CourseGradingSheet): string {
  const weightAlert =
    sheet.totalWeight > 100
      ? `<span class="status-badge status-bad">Peso total ${sheet.totalWeight}%</span>`
      : sheet.totalWeight < 100 && sheet.assignments.length > 0
        ? `<span class="status-badge status-warn">Falta peso: ${100 - sheet.totalWeight}%</span>`
        : "";
  return `<div class="pensum-summary">
    <div><b>${sheet.roster.length}</b><span>inscritos</span></div>
    <div><b>${sheet.assignments.length}</b><span>tareas</span></div>
    <div><b>${sheet.totalWeight}%</b><span>peso asignado ${weightAlert}</span></div>
    <div><b>${sheet.averageFinal.toFixed(2)}</b><span>promedio materia</span></div>
    <div><b>${sheet.passedCount}/${sheet.failedCount}</b><span>aprobados/reprobados</span></div>
  </div>`;
}

function assignmentRows(sheet: CourseGradingSheet): string {
  if (sheet.assignments.length === 0) {
    return `<tr><td colspan="4">A&uacute;n no hay tareas en esta materia. Agrega la primera para poder calificar.</td></tr>`;
  }
  return sheet.assignments
    .map(
      (assignment) => `<tr>
        <td>
          <strong>${assignment.title}</strong>
          ${assignment.description ? `<br><small style="color:var(--muted-soft);">${assignment.description}</small>` : ""}
          ${assignment.dueDate ? `<br><small style="color:var(--muted-soft);">Entrega: ${new Date(assignment.dueDate).toLocaleDateString("es-CO")}</small>` : ""}
        </td>
        <td class="grade-cell">
          <input class="grade-input" type="number" step="1" min="1" max="100" value="${assignment.weight}" data-weight="${assignment.id}" />
          <small style="color:var(--muted-soft);">% del peso</small>
        </td>
        <td>${assignment.gradedCount} / ${sheet.roster.length}</td>
        <td><button class="outline-button-dark" data-task-delete="${assignment.id}" type="button">Eliminar</button></td>
      </tr>`,
    )
    .join("");
}

function rosterRows(sheet: CourseGradingSheet): string {
  if (sheet.roster.length === 0) {
    return `<tr><td colspan="${sheet.assignments.length + 3}">No hay estudiantes inscritos en esta materia.</td></tr>`;
  }
  return sheet.roster
    .map((student) => {
      const taskCells = sheet.assignments
        .map((assignment) => {
          const value = student.taskGrades[assignment.id];
          return `<td class="grade-cell">
            <input class="grade-input" type="number" step="0.1" min="0" max="${MAX_GRADE}" value="${value ?? ""}" placeholder="—"
              data-task-grade="${assignment.id}" data-student="${student.studentId}" data-enrollment="${student.enrollmentId}" />
          </td>`;
        })
        .join("");
      const finalClass =
        student.approved === undefined ? "" : student.approved ? "status-good" : "status-bad";
      const isProvisional = student.finalGrade === undefined && student.provisional !== undefined;
      const finalLabel =
        student.approved === undefined
          ? isProvisional
            ? `Provisional ${student.provisional?.toFixed(2)}`
            : "Sin nota"
          : student.approved
            ? "Aprobada"
            : "Reprobada";
      const shownGrade = student.finalGrade ?? student.provisional ?? "";
      return `<tr>
        <td><strong>${student.studentName}</strong><br><small style="color:var(--muted-soft);">${student.studentEmail}</small></td>
        ${taskCells}
        <td class="grade-cell">
          <input class="grade-input grade-final" type="number" step="0.01" min="0" max="${MAX_GRADE}" value="${shownGrade}" placeholder="—"
            data-final-grade="${student.enrollmentId}" data-student="${student.studentId}" />
          <span class="status-badge ${finalClass}" data-final-status="${student.enrollmentId}">${finalLabel}</span>
        </td>
        <td><button class="outline-button-dark" data-unenroll="${student.enrollmentId}" type="button">Quitar</button></td>
      </tr>`;
    })
    .join("");
}

function candidateStudents(sheet: CourseGradingSheet): string {
  const course = sheet.course;
  if (!course) return "";
  const accounts = getAccounts();
  const admittedIds = new Set(
    listAllApplications()
      .filter((item) => item.status === "Admitido" && item.programId === course.programId)
      .map((item) => item.applicantId),
  );
  const enrolled = new Set(sheet.roster.map((item) => item.studentId));
  const candidates = accounts
    .filter((item) => item.role === "Estudiante" && admittedIds.has(item.id) && !enrolled.has(item.id))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  if (candidates.length === 0) return "";
  return `<option value="">Agregar estudiante al curso…</option>
    ${candidates
      .map((item) => `<option value="${item.id}">${item.firstName} ${item.lastName} (${item.email})</option>`)
      .join("")}`;
}

export function renderGradingView(account: Account, query: URLSearchParams): void {
  const selectedId = query.get("o") ?? undefined;
  const sheet = selectedId ? gradingSheet(selectedId, listAllEnrollments()) : undefined;

  const body = sheet
    ? `<section class="profile-section">
        <header class="profile-section-header">
          <span class="eyebrow">${sheet.course?.code ?? ""} · ${getPeriod(sheet.offering.periodId)?.name ?? ""}</span>
          <h2>${sheet.course?.name ?? "Materia"}</h2>
        </header>
        <p class="program-note" style="margin-bottom:16px;">Docente: ${sheet.offering.professor} &middot; ${sheet.offering.day} ${sheet.offering.startTime}&ndash;${sheet.offering.endTime} &middot; ${sheet.offering.capacity} cupos</p>
        ${summaryHtml(sheet)}

        <h3 class="pensum-section-title" style="margin-top:28px;">Tareas de la materia</h3>
        <p class="program-note" style="margin-bottom:14px;">El porcentaje de cada tarea define qu&eacute; parte de la nota final representa. La nota final se recalcula sola como promedio ponderado de las tareas calificadas.</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr><th>Tarea</th><th>Peso</th><th>Calificadas</th><th></th></tr></thead>
            <tbody>${assignmentRows(sheet)}</tbody>
          </table>
        </div>

        <form id="assignment-form" novalidate style="margin-top:18px;">
          <div class="form-grid">
            <label>T&iacute;tulo<input name="title" type="text" placeholder="Parcial 1" required /></label>
            <label>Porcentaje del peso<input name="weight" type="number" step="1" min="1" max="100" value="30" required /></label>
            <label class="wide-label">Descripci&oacute;n<input name="description" type="text" placeholder="Detalle de la evaluaci&oacute;n" /></label>
            <label>Fecha de entrega<input name="dueDate" type="date" /></label>
          </div>
          <div id="form-message" class="form-message"></div>
          <div class="form-footer">
            <p>El peso total de las tareas no debería pasar de 100%.</p>
            <button type="submit">Agregar tarea &rarr;</button>
          </div>
        </form>

        <h3 class="pensum-section-title" style="margin-top:28px;">Notas por estudiante</h3>
        <div class="form-footer" style="justify-content:flex-start;margin-bottom:14px;">
          <select id="add-student" class="student-picker">${candidateStudents(sheet)}</select>
          <button class="secondary-button" id="add-student-btn" type="button">Inscribir estudiante</button>
        </div>
        <div class="table-scroll">
          <table class="data-table grading-table">
            <thead><tr>
              <th>Estudiante</th>
              ${sheet.assignments.map((a) => `<th>${a.title}<br><small>${a.weight}%</small></th>`).join("")}
              <th>Nota final</th><th></th>
            </tr></thead>
            <tbody>${rosterRows(sheet)}</tbody>
          </table>
        </div>
      </section>`
    : `<section class="profile-section">
        <header class="profile-section-header">
          <span class="eyebrow">Gesti&oacute;n acad&eacute;mica</span>
          <h2>Tareas y calificaciones</h2>
        </header>
        <p class="program-note" style="margin-bottom:16px;">Elige una materia para crear tareas, ponerle nota a cada estudiante y ver c&oacute;mo se refleja en la nota final.</p>
        <label>Materia<select id="course-picker">${courseOptions(selectedId)}</select></label>
      </section>`;

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Staff acad&eacute;mico</span>
          <h1>Tareas y calificaciones</h1>
          <p>Crea tareas con su porcentaje de peso, califica a cada estudiante matriculado y la nota final se recalcula sola.</p>
        </div>
      </div>
      <div id="form-message-top" class="form-message"></div>
      ${
        sheet
          ? `<div class="form-footer" style="justify-content:flex-start;margin-bottom:18px;">
               <select id="course-picker" class="student-picker">${courseOptions(selectedId)}</select>
             </div>`
          : ""
      }
      ${body}
    </section>`,
    "Tareas y calificaciones",
    account,
  );

  document.querySelector<HTMLSelectElement>("#course-picker")?.addEventListener("change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    location.hash = value ? `grading?o=${value}` : "grading";
  });

  const form = document.querySelector<HTMLFormElement>("#assignment-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const result = createAssignment({
      offeringId: selectedId ?? "",
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      weight: Number(data.get("weight") ?? 0),
      dueDate: String(data.get("dueDate") ?? "") || undefined,
    });
    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    renderGradingView(account, query);
  });

  document.querySelectorAll<HTMLInputElement>("[data-weight]").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.dataset.weight;
      const weight = Number(input.value);
      if (!id || Number.isNaN(weight) || weight <= 0 || weight > 100) {
        setFormMessage("El porcentaje debe estar entre 1 y 100.", "error");
        return;
      }
      updateAssignment(id, { weight });
      // Recalcular las notas finales: cambia el peso de la tarea.
      if (selectedId) {
        listAllEnrollments()
          .filter((item) => item.offeringId === selectedId && item.status !== "Cancelada")
          .forEach((item) => recalculateFinalGrade(selectedId, item.studentId));
      }
      renderGradingView(account, query);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-task-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.taskDelete;
      if (!id) return;
      deleteAssignment(id);
      renderGradingView(account, query);
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-task-grade]").forEach((input) => {
    input.addEventListener("change", async () => {
      const assignmentId = input.dataset.taskGrade;
      const studentId = input.dataset.student;
      const enrollmentId = input.dataset.enrollment;
      if (!assignmentId || !studentId || !enrollmentId) return;
      if (input.value.trim() === "") {
        clearAssignmentGrade(assignmentId, studentId);
        renderGradingView(account, query);
        return;
      }
      const value = Number(input.value);
      const result = setAssignmentGrade({ assignmentId, studentId, enrollmentId, value });
      if (!result.ok) {
        setFormMessage(result.message, "error");
        return;
      }
      const offering = getOffering(selectedId ?? "");
      const course = offering ? getCourse(offering.courseId) : undefined;
      if (result.finalGrade !== undefined && course) {
        notifyFinalGrade(studentId, course.name, result.finalGrade);
      }
      renderGradingView(account, query);
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-final-grade]").forEach((input) => {
    input.addEventListener("change", () => {
      const enrollmentId = input.dataset.finalGrade;
      const studentId = input.dataset.student;
      if (!enrollmentId) return;
      if (input.value.trim() === "") {
        clearGrade(enrollmentId);
        renderGradingView(account, query);
        return;
      }
      const grade = Number(input.value);
      if (Number.isNaN(grade) || grade < 0 || grade > MAX_GRADE) {
        setFormMessage(`La nota debe estar entre 0.0 y ${MAX_GRADE.toFixed(1)}.`, "error");
        return;
      }
      recordGrade(enrollmentId, grade);
      const offering = getOffering(selectedId ?? "");
      const course = offering ? getCourse(offering.courseId) : undefined;
      if (studentId && course) notifyFinalGrade(studentId, course.name, grade);
      renderGradingView(account, query);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-unenroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const enrollmentId = button.dataset.unenroll;
      if (!enrollmentId) return;
      cancel(enrollmentId);
      renderGradingView(account, query);
    });
  });

  document.querySelector<HTMLButtonElement>("#add-student-btn")?.addEventListener("click", () => {
    const picker = document.querySelector<HTMLSelectElement>("#add-student");
    const studentId = picker?.value;
    if (!studentId || !selectedId) return;
    const result = enroll(studentId, selectedId);
    if (!result.ok) {
      setFormMessage(result.message, "error");
      return;
    }
    renderGradingView(account, query);
  });
}
