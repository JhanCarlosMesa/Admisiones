import type { Assignment, AssignmentGrade, Course, CourseOffering, Enrollment } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { getCourse, getOffering } from "./catalog.service";
import { MAX_GRADE, MIN_GRADE, recordGrade } from "./grades.service";
import { notifyUser } from "./notifications.service";

// ------------------------------------------------------------
// Tareas
// ------------------------------------------------------------

function getAllAssignments(): Assignment[] {
  return readList<Assignment>(STORAGE_KEYS.assignments);
}

function saveAssignments(list: Assignment[]): void {
  writeList(STORAGE_KEYS.assignments, list);
}

export function listAssignmentsByOffering(offeringId: string): Assignment[] {
  return getAllAssignments()
    .filter((item) => item.offeringId === offeringId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listAssignmentsByPeriod(periodId: string): Assignment[] {
  return getAllAssignments()
    .filter((item) => item.periodId === periodId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Porcentaje que ya suman los pesos de las tareas de una oferta. */
export function totalWeight(offeringId: string): number {
  return listAssignmentsByOffering(offeringId).reduce((sum, item) => sum + item.weight, 0);
}

export interface CreateAssignmentInput {
  offeringId: string;
  title: string;
  description?: string;
  weight: number;
  dueDate?: string;
}

export function createAssignment(input: CreateAssignmentInput): { ok: true; assignment: Assignment } | { ok: false; message: string } {
  const offering = getOffering(input.offeringId);
  if (!offering) return { ok: false, message: "La materia seleccionada no existe." };
  if (!input.title.trim()) return { ok: false, message: "La tarea necesita un título." };
  if (input.weight <= 0 || input.weight > 100) {
    return { ok: false, message: "El porcentaje debe estar entre 1 y 100." };
  }
  const assignment: Assignment = {
    id: generateId("TSK"),
    offeringId: offering.id,
    courseId: offering.courseId,
    periodId: offering.periodId,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    weight: input.weight,
    dueDate: input.dueDate,
    createdAt: new Date().toISOString(),
  };
  saveAssignments([...getAllAssignments(), assignment]);
  return { ok: true, assignment };
}

export function updateAssignment(
  id: string,
  patch: { title?: string; description?: string; weight?: number; dueDate?: string },
): Assignment | undefined {
  const list = getAllAssignments();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  const updated: Assignment = {
    ...list[index],
    title: patch.title?.trim() || list[index].title,
    description: patch.description?.trim() ?? list[index].description,
    weight: patch.weight ?? list[index].weight,
    dueDate: patch.dueDate ?? list[index].dueDate,
  };
  list[index] = updated;
  saveAssignments(list);
  return updated;
}

/** Elimina la tarea y sus notas. La nota final se recalcula. */
export function deleteAssignment(id: string): void {
  const assignment = getAllAssignments().find((item) => item.id === id);
  saveAssignments(getAllAssignments().filter((item) => item.id !== id));
  const affected = getAllAssignmentGrades().filter((item) => item.assignmentId === id);
  saveAssignmentGrades(getAllAssignmentGrades().filter((item) => item.assignmentId !== id));
  if (!assignment) return;
  const studentIds = [...new Set(affected.map((item) => item.studentId))];
  studentIds.forEach((studentId) => recalculateFinalGrade(assignment.offeringId, studentId));
}

// ------------------------------------------------------------
// Notas por tarea
// ------------------------------------------------------------

function getAllAssignmentGrades(): AssignmentGrade[] {
  return readList<AssignmentGrade>(STORAGE_KEYS.assignmentGrades);
}

function saveAssignmentGrades(list: AssignmentGrade[]): void {
  writeList(STORAGE_KEYS.assignmentGrades, list);
}

export function listGradesByAssignment(assignmentId: string): AssignmentGrade[] {
  return getAllAssignmentGrades().filter((item) => item.assignmentId === assignmentId);
}

export function listGradesByStudent(studentId: string): AssignmentGrade[] {
  return getAllAssignmentGrades().filter((item) => item.studentId === studentId);
}

/** Nota de un estudiante en una tarea, si existe. */
export function gradeFor(assignmentId: string, studentId: string): AssignmentGrade | undefined {
  return getAllAssignmentGrades().find(
    (item) => item.assignmentId === assignmentId && item.studentId === studentId,
  );
}

/**
 * Registra la nota de un estudiante en una tarea y recalcula su nota final.
 * `value` en escala 0–5. Devuelve la nota final recalculada.
 */
export function setAssignmentGrade(input: {
  assignmentId: string;
  studentId: string;
  enrollmentId: string;
  value: number;
}): { ok: true; finalGrade: number | undefined } | { ok: false; message: string } {
  const assignment = getAllAssignments().find((item) => item.id === input.assignmentId);
  if (!assignment) return { ok: false, message: "La tarea no existe." };
  if (input.value < 0 || input.value > MAX_GRADE) {
    return { ok: false, message: `La nota debe estar entre 0.0 y ${MAX_GRADE.toFixed(1)}.` };
  }

  const list = getAllAssignmentGrades();
  const index = list.findIndex(
    (item) => item.assignmentId === input.assignmentId && item.studentId === input.studentId,
  );
  const now = new Date().toISOString();
  if (index === -1) {
    list.push({
      id: generateId("NTG"),
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      enrollmentId: input.enrollmentId,
      value: input.value,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    list[index] = { ...list[index], value: input.value, updatedAt: now };
  }
  saveAssignmentGrades(list);

  const finalGrade = recalculateFinalGrade(assignment.offeringId, input.studentId);
  return { ok: true, finalGrade };
}

/** Borra la nota de un estudiante en una tarea y recalcula la nota final. */
export function clearAssignmentGrade(assignmentId: string, studentId: string): void {
  const assignment = getAllAssignments().find((item) => item.id === assignmentId);
  saveAssignmentGrades(
    getAllAssignmentGrades().filter(
      (item) => !(item.assignmentId === assignmentId && item.studentId === studentId),
    ),
  );
  if (!assignment) return;
  recalculateFinalGrade(assignment.offeringId, studentId);
}

/**
 * Nota final de una materia: promedio ponderado de las tareas calificadas
 * según su porcentaje. La nota solo se oficializa cuando todas las tareas
 * tienen nota; mientras tanto se devuelve como provisional.
 */
export function recalculateFinalGrade(offeringId: string, studentId: string): number | undefined {
  const assignments = listAssignmentsByOffering(offeringId);
  if (assignments.length === 0) return undefined;

  let weightSum = 0;
  let weighted = 0;
  assignments.forEach((assignment) => {
    const grade = gradeFor(assignment.id, studentId);
    if (!grade) return;
    weightSum += assignment.weight;
    weighted += grade.value * assignment.weight;
  });
  if (weightSum === 0) return undefined;

  const provisional = Math.round((weighted / weightSum) * 100) / 100;
  const enrollment = getEnrollment(studentId, offeringId);
  if (!enrollment) return provisional;

  const totalWeight = assignments.reduce((sum, item) => sum + item.weight, 0);
  if (weightSum >= totalWeight) {
    recordGrade(enrollment.id, provisional);
  }
  return provisional;
}

/** Nota acumulada hasta ahora, aunque todavía falten tareas por calificar. */
export function provisionalGrade(offeringId: string, studentId: string): number | undefined {
  const assignments = listAssignmentsByOffering(offeringId);
  let weightSum = 0;
  let weighted = 0;
  assignments.forEach((assignment) => {
    const grade = gradeFor(assignment.id, studentId);
    if (!grade) return;
    weightSum += assignment.weight;
    weighted += grade.value * assignment.weight;
  });
  if (weightSum === 0) return undefined;
  return Math.round((weighted / weightSum) * 100) / 100;
}

function getEnrollment(studentId: string, offeringId: string): Enrollment | undefined {
  return readList<Enrollment>(STORAGE_KEYS.enrollments).find(
    (item) => item.studentId === studentId && item.offeringId === offeringId && item.status !== "Cancelada",
  );
}

// ------------------------------------------------------------
// Vista completa de una materia: tareas + roster + notas
// ------------------------------------------------------------

export interface RosterStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  enrollmentId: string;
  finalGrade: number | undefined;
  /** Nota acumulada mientras faltan tareas por calificar. */
  provisional: number | undefined;
  approved: boolean | undefined;
  /** Nota de cada tarea, indexada por id de tarea. */
  taskGrades: Record<string, number | undefined>;
}

export interface AssignmentWithGrades extends Assignment {
  grades: AssignmentGrade[];
  gradedCount: number;
}

export interface CourseGradingSheet {
  offering: CourseOffering;
  course: Course | undefined;
  assignments: AssignmentWithGrades[];
  roster: RosterStudent[];
  totalWeight: number;
  /** Promedio de la nota final de los estudiantes con nota. */
  averageFinal: number;
  passedCount: number;
  failedCount: number;
}

/** Hoja de calificación completa de una materia en un periodo. */
export function gradingSheet(offeringId: string, enrollments: Enrollment[]): CourseGradingSheet | undefined {
  const offering = getOffering(offeringId);
  if (!offering) return undefined;
  const course = getCourse(offering.courseId);

  const assignmentList = listAssignmentsByOffering(offeringId);
  // Una sola lectura de todas las notas de la materia: con cientos de
  // estudiantes, consultarlas tarea por tarea multiplicaba el tiempo.
  const allGrades = getAllAssignmentGrades().filter((grade) =>
    assignmentList.some((assignment) => assignment.id === grade.assignmentId),
  );
  const assignments = assignmentList.map((assignment) => {
    const grades = allGrades.filter((grade) => grade.assignmentId === assignment.id);
    return { ...assignment, grades, gradedCount: grades.length };
  });

  const rosterEnrollments = enrollments.filter(
    (item) => item.offeringId === offeringId && item.status !== "Cancelada",
  );
  const accounts = readList<{ id: string; firstName: string; lastName: string; email: string }>(
    STORAGE_KEYS.accounts,
  );

  const roster: RosterStudent[] = rosterEnrollments.map((enrollment) => {
    const account = accounts.find((item) => item.id === enrollment.studentId);
    const taskGrades: Record<string, number | undefined> = {};
    let weightSum = 0;
    let weighted = 0;
    assignments.forEach((assignment) => {
      const grade = allGrades.find(
        (item) => item.assignmentId === assignment.id && item.studentId === enrollment.studentId,
      );
      taskGrades[assignment.id] = grade?.value;
      if (grade) {
        weightSum += assignment.weight;
        weighted += grade.value * assignment.weight;
      }
    });
    return {
      studentId: enrollment.studentId,
      studentName: account ? `${account.firstName} ${account.lastName}` : enrollment.studentId,
      studentEmail: account?.email ?? "",
      enrollmentId: enrollment.id,
      finalGrade: enrollment.grade,
      provisional: weightSum === 0 ? undefined : Math.round((weighted / weightSum) * 100) / 100,
      approved: enrollment.grade === undefined ? undefined : enrollment.grade >= MIN_GRADE,
      taskGrades,
    };
  });
  roster.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const withGrade = roster.filter((item) => item.finalGrade !== undefined);
  const averageFinal = withGrade.length
    ? withGrade.reduce((sum, item) => sum + (item.finalGrade ?? 0), 0) / withGrade.length
    : 0;

  return {
    offering,
    course,
    assignments,
    roster,
    totalWeight: assignments.reduce((sum, item) => sum + item.weight, 0),
    averageFinal,
    passedCount: withGrade.filter((item) => item.approved).length,
    failedCount: withGrade.filter((item) => item.approved === false).length,
  };
}

/** Avisa al estudiante del cambio en su nota final de la materia. */
export function notifyFinalGrade(
  studentId: string,
  courseName: string,
  finalGrade: number,
): void {
  notifyUser(
    studentId,
    `Nueva nota en ${courseName}`,
    `Tu nota final es ${finalGrade.toFixed(2)}. ${
      finalGrade >= MIN_GRADE
        ? "Materia aprobada: los créditos ya cuentan para tu avance al grado."
        : "Materia reprobada: debes repetirla para avanzar."
    }`,
    finalGrade >= MIN_GRADE ? "success" : "danger",
  );
}

// ------------------------------------------------------------
// Vista del estudiante: sus tareas, su nota final y su desglose
// ------------------------------------------------------------

export interface StudentTaskDetail {
  assignment: Assignment;
  value: number | undefined;
  /** Aporte de esta tarea a la nota final (valor × peso). */
  contribution: number;
}

export interface StudentCourseDetail {
  enrollment: Enrollment;
  course: Course | undefined;
  offering: CourseOffering | undefined;
  periodId: string;
  finalGrade: number | undefined;
  approved: boolean | undefined;
  tasks: StudentTaskDetail[];
  weightTotal: number;
  pendingTasks: number;
}

/** Detalle de todas las materias del estudiante con su desglose de tareas. */
export function studentCourseDetails(studentId: string): StudentCourseDetail[] {
  const enrollments = readList<Enrollment>(STORAGE_KEYS.enrollments).filter(
    (item) => item.studentId === studentId && item.status !== "Cancelada",
  );
  return enrollments
    .map((enrollment) => {
      const offering = getOffering(enrollment.offeringId);
      const course = offering ? getCourse(offering.courseId) : undefined;
      const assignments = listAssignmentsByOffering(enrollment.offeringId);
      const tasks: StudentTaskDetail[] = assignments.map((assignment) => {
        const grade = gradeFor(assignment.id, studentId);
        return {
          assignment,
          value: grade?.value,
          contribution: grade ? (grade.value * assignment.weight) / 100 : 0,
        };
      });
      return {
        enrollment,
        course,
        offering,
        periodId: enrollment.periodId,
        finalGrade: enrollment.grade,
        approved: enrollment.grade === undefined ? undefined : enrollment.grade >= MIN_GRADE,
        tasks,
        weightTotal: assignments.reduce((sum, item) => sum + item.weight, 0),
        pendingTasks: tasks.filter((item) => item.value === undefined).length,
      };
    })
    .sort((a, b) => b.periodId.localeCompare(a.periodId));
}
