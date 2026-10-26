import type { Course, CourseOffering, Enrollment } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { getActivePeriod, getCourse, getOffering } from "./catalog.service";
import { MIN_GRADE, approvedCourseCodes } from "./grades.service";
import { listPrerequisitesByStudent } from "./prerequisites.service";
import { createNotification } from "./notifications.service";
import {
  joinWaitlist,
  listByStudent as listWaitlistByStudent,
  listByOffering,
  markPromoted,
  nextInLine,
} from "./waitlist.service";

export const MAX_CREDITS_PER_PERIOD = 18;

function getAll(): Enrollment[] {
  return readList<Enrollment>(STORAGE_KEYS.enrollments);
}

function saveAll(list: Enrollment[]): void {
  writeList(STORAGE_KEYS.enrollments, list);
}

export function getActiveEnrollments(studentId: string, periodId: string): Enrollment[] {
  return getAll().filter(
    (item) => item.studentId === studentId && item.periodId === periodId && item.status === "Matriculada",
  );
}

export function getEnrollmentHistory(studentId: string): Enrollment[] {
  return getAll()
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAllEnrollments(): Enrollment[] {
  return getAll();
}

export function occupiedSeats(offeringId: string): number {
  return getAll().filter((item) => item.offeringId === offeringId && item.status === "Matriculada").length;
}

export function availableSeats(offering: CourseOffering): number {
  return Math.max(0, offering.capacity - occupiedSeats(offering.id));
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function creditsInUse(studentId: string, periodId: string): number {
  return getActiveEnrollments(studentId, periodId).reduce((total, item) => {
    const offering = getOffering(item.offeringId);
    const course = offering ? getCourse(offering.courseId) : undefined;
    return total + (course?.credits ?? 0);
  }, 0);
}

// ------------------------------------------------------------
// Prerrequisitos
// ------------------------------------------------------------

/**
 * Un prerrequisito se satisface si el estudiante lo aprobó con nota o si le
 * fue homologada externamente por el equipo académico.
 */
export function satisfiedCourseCodes(studentId: string): Set<string> {
  const codes = approvedCourseCodes(studentId);
  listPrerequisitesByStudent(studentId)
    .filter((item) => item.status === "Aprobada")
    .forEach((item) => codes.add(item.courseCode.trim().toUpperCase()));
  return codes;
}

/** Materias que bloquean la matrícula de un curso, con su nombre. */
export function missingPrerequisites(studentId: string, course: Course): Course[] {
  const required = course.prerequisites ?? [];
  if (required.length === 0) return [];
  const satisfied = satisfiedCourseCodes(studentId);
  const missing: Course[] = [];
  required.forEach((code) => {
    if (satisfied.has(code.trim().toUpperCase())) return;
    const match = getCourseByCode(code);
    if (match) missing.push(match);
  });
  return missing;
}

function getCourseByCode(code: string): Course | undefined {
  const normalized = code.trim().toUpperCase();
  return readList<Course>(STORAGE_KEYS.courses).find(
    (item) => item.code.trim().toUpperCase() === normalized,
  );
}

/** Materia del mismo curso que el estudiante ya aprobó (no se puede repetir). */
function alreadyApprovedCourse(studentId: string, course: Course): boolean {
  return getAll().some((item) => {
    if (item.studentId !== studentId || item.status === "Cancelada") return false;
    if (item.grade === undefined || item.grade < MIN_GRADE) return false;
    const offering = getOffering(item.offeringId);
    return offering?.courseId === course.id;
  });
}

// ------------------------------------------------------------
// Evaluación de una matrícula
// ------------------------------------------------------------

export type EnrollmentBlockReason =
  | "ok"
  | "sin-periodo"
  | "materia-inexistente"
  | "ya-matriculada"
  | "materia-aprobada"
  | "prerrequisitos"
  | "limite-creditos"
  | "choque-horario"
  | "sin-cupos";

export interface EnrollmentEvaluation {
  ok: boolean;
  reason: EnrollmentBlockReason;
  message: string;
  missing: Course[];
  seats: number;
}

/** Evalúa si un estudiante puede matricular una oferta, sin modificar nada. */
export function evaluateEnrollment(studentId: string, offeringId: string): EnrollmentEvaluation {
  const period = getActivePeriod();
  if (!period) {
    return block("sin-periodo", "No hay un periodo académico activo para matricularse.");
  }

  const offering = getOffering(offeringId);
  if (!offering) {
    return block("materia-inexistente", "La materia seleccionada no existe.");
  }

  const course = getCourse(offering.courseId);
  if (!course) {
    return block("materia-inexistente", "La materia seleccionada no existe.");
  }

  const current = getActiveEnrollments(studentId, period.id);
  if (current.some((item) => item.offeringId === offeringId)) {
    return block("ya-matriculada", "Ya estás matriculado en esta materia.");
  }

  if (alreadyApprovedCourse(studentId, course)) {
    return block("materia-aprobada", `Ya aprobaste ${course.name} en un periodo anterior.`);
  }

  const missing = missingPrerequisites(studentId, course);
  if (missing.length > 0) {
    const names = missing.map((item) => `${item.code} ${item.name}`).join(", ");
    return {
      ok: false,
      reason: "prerrequisitos",
      message: `Te faltan prerrequisitos: ${names}.`,
      missing,
      seats: availableSeats(offering),
    };
  }

  const usedCredits = creditsInUse(studentId, period.id);
  if (usedCredits + course.credits > MAX_CREDITS_PER_PERIOD) {
    return block(
      "limite-creditos",
      `Superarías el límite de ${MAX_CREDITS_PER_PERIOD} créditos permitidos por periodo.`,
    );
  }

  const hasConflict = current.some((item) => {
    const existing = getOffering(item.offeringId);
    return (
      existing &&
      existing.day === offering.day &&
      timesOverlap(existing.startTime, existing.endTime, offering.startTime, offering.endTime)
    );
  });
  if (hasConflict) {
    return block("choque-horario", "Esta materia choca de horario con otra que ya tienes matriculada.");
  }

  const seats = availableSeats(offering);
  if (seats <= 0) {
    return block("sin-cupos", "No hay cupos disponibles para esta materia.");
  }

  return { ok: true, reason: "ok", message: "", missing: [], seats };
}

function block(reason: EnrollmentBlockReason, message: string): EnrollmentEvaluation {
  return { ok: false, reason, message, missing: [], seats: 0 };
}

// ------------------------------------------------------------
// Matrícula
// ------------------------------------------------------------

export function enroll(studentId: string, offeringId: string): { ok: true } | { ok: false; message: string } {
  const evaluation = evaluateEnrollment(studentId, offeringId);
  if (!evaluation.ok) {
    return { ok: false, message: evaluation.message };
  }
  return createEnrollment(studentId, offeringId) ? { ok: true } : { ok: false, message: "No se pudo registrar la matrícula." };
}

function createEnrollment(studentId: string, offeringId: string): boolean {
  const period = getActivePeriod();
  const offering = getOffering(offeringId);
  if (!period || !offering) return false;
  const enrollment: Enrollment = {
    id: generateId("MAT"),
    studentId,
    offeringId,
    periodId: period.id,
    status: "Matriculada",
    createdAt: new Date().toISOString(),
  };
  saveAll([...getAll(), enrollment]);
  return true;
}

/** Cancela una materia y, si había lista de espera, promueve al siguiente. */
export function cancel(enrollmentId: string): void {
  const target = getAll().find((item) => item.id === enrollmentId);
  saveAll(getAll().map((item) => (item.id === enrollmentId ? { ...item, status: "Cancelada" } : item)));
  if (!target) return;
  promoteFromWaitlist(target.offeringId);
}

/** Da el cupo liberado al primer estudiante de la lista de espera. */
function promoteFromWaitlist(offeringId: string): void {
  const offering = getOffering(offeringId);
  if (!offering) return;
  if (availableSeats(offering) <= 0) return;

  const next = nextInLine(offeringId);
  if (!next) return;

  const evaluation = evaluateEnrollment(next.studentId, offeringId);
  if (!evaluation.ok) return; // sigue esperando: no cumple las reglas todavía

  if (!createEnrollment(next.studentId, offeringId)) return;
  markPromoted(next.id);

  const course = getCourse(offering.courseId);
  createNotification({
    audience: next.studentId,
    title: "Cupo liberado en tu lista de espera",
    body: `Te asignamos el cupo de ${course?.name ?? "la materia"}. Ya puedes verla en tu matrícula actual.`,
    type: "success",
  });
}

/** Lista de espera del estudiante, con su posición y la materia en espera. */
export interface WaitlistItem {
  id: string;
  offeringId: string;
  courseName: string;
  courseCode: string;
  professor: string;
  day: string;
  time: string;
  position: number;
  status: string;
  createdAt: string;
}

export function getWaitlistForStudent(studentId: string): WaitlistItem[] {
  return listWaitlistByStudent(studentId).map((entry) => {
    const offering = getOffering(entry.offeringId);
    const course = offering ? getCourse(offering.courseId) : undefined;
    const position = listByOffering(entry.offeringId).findIndex((item) => item.id === entry.id) + 1;
    return {
      id: entry.id,
      offeringId: entry.offeringId,
      courseName: course?.name ?? "Materia",
      courseCode: course?.code ?? "",
      professor: offering?.professor ?? "Por asignar",
      day: offering?.day ?? "",
      time: offering ? `${offering.startTime}–${offering.endTime}` : "",
      position,
      status: entry.status,
      createdAt: entry.createdAt,
    };
  });
}

/** Enlaza al estudiante a la lista de espera de una materia sin cupo. */
export function enrollInWaitlist(input: {
  studentId: string;
  studentEmail: string;
  studentName: string;
  offeringId: string;
}): { ok: true; position: number } | { ok: false; message: string } {
  const result = joinWaitlist(input);
  if (!result.ok) return result;
  const offering = getOffering(input.offeringId);
  const course = offering ? getCourse(offering.courseId) : undefined;
  createNotification({
    audience: input.studentId,
    title: "Entraste a la lista de espera",
    body: `Quedaste en la posición ${result.position} de la lista de espera de ${course?.name ?? "la materia"}. Te avisamos si se libera un cupo.`,
    type: "info",
  });
  return result;
}
