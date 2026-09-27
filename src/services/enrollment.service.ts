import type { CourseOffering, Enrollment } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { getActivePeriod, getCourse, getOffering } from "./catalog.service";

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

export function enroll(studentId: string, offeringId: string): { ok: true } | { ok: false; message: string } {
  const period = getActivePeriod();
  if (!period) return { ok: false, message: "No hay un periodo académico activo para matricularse." };

  const offering = getOffering(offeringId);
  if (!offering) return { ok: false, message: "La materia seleccionada no existe." };

  const course = getCourse(offering.courseId);
  if (!course) return { ok: false, message: "La materia seleccionada no existe." };

  const current = getActiveEnrollments(studentId, period.id);
  if (current.some((item) => item.offeringId === offeringId)) {
    return { ok: false, message: "Ya estás matriculado en esta materia." };
  }

  const usedCredits = creditsInUse(studentId, period.id);
  if (usedCredits + course.credits > MAX_CREDITS_PER_PERIOD) {
    return {
      ok: false,
      message: `Superarías el límite de ${MAX_CREDITS_PER_PERIOD} créditos permitidos por periodo.`,
    };
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
    return { ok: false, message: "Esta materia choca de horario con otra que ya tienes matriculada." };
  }

  if (availableSeats(offering) <= 0) {
    return { ok: false, message: "No hay cupos disponibles para esta materia." };
  }

  const enrollment: Enrollment = {
    id: generateId("MAT"),
    studentId,
    offeringId,
    periodId: period.id,
    status: "Matriculada",
    createdAt: new Date().toISOString(),
  };
  saveAll([...getAll(), enrollment]);
  return { ok: true };
}

export function cancel(enrollmentId: string): void {
  saveAll(getAll().map((item) => (item.id === enrollmentId ? { ...item, status: "Cancelada" } : item)));
}
