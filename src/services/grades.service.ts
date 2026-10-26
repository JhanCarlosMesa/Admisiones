import type { Course, Enrollment } from "../types";
import { readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { getCourse, getCoursesByProgram, getOffering } from "./catalog.service";

/** Escala de calificación UNAC: 0.0 a 5.0. Aprobación desde 3.0. */
export const MIN_GRADE = 3.0;
export const MAX_GRADE = 5.0;

export interface GradedCourse {
  enrollment: Enrollment;
  course: Course;
  periodId: string;
  grade: number;
  approved: boolean;
}

function getAllEnrollments(): Enrollment[] {
  return readList<Enrollment>(STORAGE_KEYS.enrollments);
}

/** Materias cursadas (no canceladas) que ya tienen nota registrada. */
export function listGradedCourses(studentId: string): GradedCourse[] {
  return getAllEnrollments()
    .filter((item) => item.studentId === studentId && item.status !== "Cancelada")
    .map((enrollment) => {
      const offering = getOffering(enrollment.offeringId);
      const course = offering ? getCourse(offering.courseId) : undefined;
      if (!course || enrollment.grade === undefined) return undefined;
      return {
        enrollment,
        course,
        periodId: enrollment.periodId,
        grade: enrollment.grade,
        approved: enrollment.grade >= MIN_GRADE,
      };
    })
    .filter((item): item is GradedCourse => item !== undefined);
}

/** Créditos ganados por el estudiante (materias aprobadas). */
export function earnedCredits(studentId: string): number {
  return listGradedCourses(studentId)
    .filter((item) => item.approved)
    .reduce((total, item) => total + item.course.credits, 0);
}

/** Promedio ponderado por créditos, en escala 0–5. */
export function gradeAverage(studentId: string): number {
  const graded = listGradedCourses(studentId);
  const credits = graded.reduce((total, item) => total + item.course.credits, 0);
  if (credits === 0) return 0;
  const weighted = graded.reduce((total, item) => total + item.grade * item.course.credits, 0);
  return weighted / credits;
}

/** Códigos de las materias que el estudiante tiene aprobadas con nota. */
export function approvedCourseCodes(studentId: string): Set<string> {
  return new Set(
    listGradedCourses(studentId)
      .filter((item) => item.approved)
      .map((item) => item.course.code),
  );
}

/**
 * Avance del estudiante hacia el grado: créditos del pensum, créditos ganados,
 * promedio y las materias obligatorias que aún faltan por aprobar.
 */
export interface GraduationProgress {
  totalCredits: number;
  earnedCredits: number;
  pendingCredits: number;
  percent: number;
  average: number;
  approvedCourses: number;
  failedCourses: number;
  pendingRequired: Course[];
  canGraduate: boolean;
}

export function graduationProgress(studentId: string, programId: string): GraduationProgress {
  const graded = listGradedCourses(studentId);
  const approvedCodes = approvedCourseCodes(studentId);
  const programCourses = getCoursesByProgram(programId);
  const totalCredits = programCourses.reduce((total, item) => total + item.credits, 0);
  const earned = earnedCredits(studentId);
  const pendingRequired = programCourses.filter(
    (item) => item.type === "Obligatoria" && !approvedCodes.has(item.code),
  );
  const pendingCredits = Math.max(0, totalCredits - earned);
  return {
    totalCredits,
    earnedCredits: earned,
    pendingCredits,
    percent: totalCredits === 0 ? 0 : Math.round((earned / totalCredits) * 100),
    average: gradeAverage(studentId),
    approvedCourses: graded.filter((item) => item.approved).length,
    failedCourses: graded.filter((item) => !item.approved).length,
    pendingRequired,
    canGraduate: earned >= totalCredits && pendingRequired.length === 0,
  };
}

/** Registra o actualiza la nota de una matrícula. */
export function recordGrade(enrollmentId: string, grade: number): boolean {
  const list = getAllEnrollments();
  const index = list.findIndex((item) => item.id === enrollmentId);
  if (index === -1) return false;
  if (grade < 0 || grade > MAX_GRADE) return false;
  list[index] = {
    ...list[index],
    grade,
    gradedAt: new Date().toISOString(),
  };
  writeList(STORAGE_KEYS.enrollments, list);
  return true;
}

/** Elimina la nota registrada para dejar la matrícula abierta a corrección. */
export function clearGrade(enrollmentId: string): void {
  const list = getAllEnrollments();
  const index = list.findIndex((item) => item.id === enrollmentId);
  if (index === -1) return;
  const { grade: _grade, gradedAt: _gradedAt, ...rest } = list[index];
  list[index] = rest;
  writeList(STORAGE_KEYS.enrollments, list);
}
