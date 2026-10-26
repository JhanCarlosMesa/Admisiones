import { graduationProgress, gradeAverage, listGradedCourses } from "./grades.service";
import { creditsInUse, getActiveEnrollments } from "./enrollment.service";
import { getCourse, getOffering, getProgram } from "./catalog.service";

/**
 * Payloads de las credenciales.
 *
 * Se construyen con las funciones de negocio que ya existen: el acta usa el
 * veredicto real de graduación, el certificado usa el historial real de notas
 * y la constancia usa la matrícula real. Así la credencial dice exactamente lo
 * mismo que dice el portal, con los mismos datos.
 *
 * OJO: este payload contiene datos que NO pueden ir a la cadena. Viaja al
 * gateway para que lo firme, pero a la cadena solo llega su hash.
 */

/** Payload del acta de grado. */
export async function buildGraduationPayload(studentId: string, programId: string) {
  const progress = graduationProgress(studentId, programId);
  const program = getProgram(programId);
  const courses = listGradedCourses(studentId).map((item) => ({
    codigo: item.course.code,
    materia: item.course.name,
    creditos: item.course.credits,
    nota: item.grade,
    periodo: item.periodId,
    aprobada: item.approved,
  }));
  return {
    tipo: "ACTA_GRADO",
    programa: program?.name ?? programId,
    plan: programId,
    creditosTotales: progress.totalCredits,
    creditosAprobados: progress.earnedCredits,
    porcentajeAvance: progress.percent,
    promedio: Number(gradeAverage(studentId).toFixed(2)),
    puedeGraduarse: progress.canGraduate,
    materias: courses,
    emitido: new Date().toISOString(),
  };
}

/** Payload del certificado de notas de un periodo. */
export function buildTranscriptPayload(studentId: string, periodId: string) {
  const courses = listGradedCourses(studentId)
    .filter((item) => item.periodId === periodId)
    .map((item) => ({
      codigo: item.course.code,
      materia: item.course.name,
      creditos: item.course.credits,
      nota: item.grade,
      aprobada: item.approved,
    }));
  return {
    tipo: "CERTIFICADO_NOTAS",
    periodo: periodId,
    promedio: Number(gradeAverage(studentId).toFixed(2)),
    materias: courses,
    emitido: new Date().toISOString(),
  };
}

/** Payload de la constancia de matrícula. */
export function buildEnrollmentPayload(studentId: string, programId: string, periodId: string) {
  const enrollments = getActiveEnrollments(studentId, periodId);
  const materias = enrollments
    .map((item) => {
      const offering = getOffering(item.offeringId);
      const course = offering ? getCourse(offering.courseId) : undefined;
      return course ? { codigo: course.code, materia: course.name } : undefined;
    })
    .filter((item): item is { codigo: string; materia: string } => Boolean(item));
  return {
    tipo: "CONSTANCIA_MATRICULA",
    programa: getProgram(programId)?.name ?? programId,
    periodo: periodId,
    creditos: creditsInUse(studentId, periodId),
    materias,
    emitido: new Date().toISOString(),
  };
}

/** Payload del certificado de homologación de una materia cursada afuera. */
export function buildHomologationPayload(input: {
  courseCode: string;
  courseName: string;
  institution: string;
  year: number;
  grade: number;
}) {
  return {
    tipo: "HOMOLOGACION",
    codigoMateria: input.courseCode,
    materia: input.courseName,
    institucion: input.institution,
    anio: input.year,
    nota: input.grade,
    emitido: new Date().toISOString(),
  };
}

/** Payload del acta de la decisión de admisión. */
export function buildAdmissionPayload(input: {
  applicantEmail: string;
  programId: string;
  decision: string;
  note?: string;
}) {
  return {
    tipo: "ACTA_ADMISION",
    correo: input.applicantEmail,
    programa: input.programId,
    decision: input.decision,
    motivo: input.note ?? "",
    emitido: new Date().toISOString(),
  };
}
