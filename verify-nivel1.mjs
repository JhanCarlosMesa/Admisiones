/**
 * Verificación headless de las reglas de negocio (calificaciones, tareas,
 * prerrequisitos, lista de espera, cohorte y notificaciones).
 * No forma parte de la app; se ejecuta con:
 *   npx esbuild verify-nivel1.mjs --bundle --platform=node --format=esm --outfile=verify-tmp.mjs && node verify-tmp.mjs
 */
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.location = { hash: "" };
globalThis.window = { addEventListener: () => {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const { seed } = await import("./src/data/seed.ts");
const { getAccounts } = await import("./src/services/auth.service.ts");
const {
  evaluateEnrollment,
  cancel,
  getWaitlistForStudent,
  enrollInWaitlist,
  getActiveEnrollments,
  listAllEnrollments,
} = await import("./src/services/enrollment.service.ts");
const { graduationProgress, gradeAverage, listGradedCourses, MIN_GRADE } = await import(
  "./src/services/grades.service.ts"
);
const { getCoursesByProgram, getOfferingsByPeriod, getCourse, getProgram } = await import(
  "./src/services/catalog.service.ts"
);
const { listActiveNotificationsFor } = await import("./src/services/notifications.service.ts");
const {
  createAssignment,
  deleteAssignment,
  setAssignmentGrade,
  gradingSheet,
  listAssignmentsByOffering,
  totalWeight,
  studentCourseDetails,
  recalculateFinalGrade,
} = await import("./src/services/assignments.service.ts");

const totalWeightOf = (offeringId) => totalWeight(offeringId);
const pendingCourseId = (studentId, offeringId) => {
  const course = getCourse(getOfferingsByPeriod("per-2026-2").find((o) => o.id === offeringId).courseId);
  return course.id;
};

let failures = 0;
function check(label, condition, extra = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` -> ${extra}` : ""}`);
}

await seed();

const accounts = getAccounts();
const valentina = accounts.find((a) => a.email === "valentina.rojas@unac.edu.co");
const mateo = accounts.find((a) => a.email === "mateo.salazar@unac.edu.co");
const staff = accounts.find((a) => a.email === "admisiones@unac.edu.co");
const sistemasCourses = getCoursesByProgram("prog-sistemas");
const activeOfferings = getOfferingsByPeriod("per-2026-2");
const offeringOf = (code) => {
  const course = sistemasCourses.find((c) => c.code === code);
  return activeOfferings.find((o) => o.courseId === course.id);
};

console.log("\n--- 0. Cohorte de estudiantes ---");
const students = accounts.filter((a) => a.role === "Estudiante");
check("hay al menos 100 estudiantes", students.length >= 100, `(${students.length})`);
const { listAll: listAllApps } = await import("./src/services/admissions.service.ts");
const perProgram = new Map();
listAllApps()
  .filter((app) => app.status === "Admitido")
  .forEach((app) => perProgram.set(app.programId, (perProgram.get(app.programId) ?? 0) + 1));
const counts = [...perProgram.values()];
check("cada programa tiene 10 estudiantes", counts.length === 10 && counts.every((c) => c === 10), `[${counts.join(",")}]`);
check("las cuentas de prueba siguen existiendo", Boolean(valentina && mateo && staff));
const emails = new Set(accounts.map((a) => a.email));
check("no hay correos duplicados", emails.size === accounts.length, `(${emails.size}/${accounts.length})`);

console.log("\n--- 1. Calificaciones y progreso a graduación ---");
const graded = listGradedCourses(valentina.id);
const historical = graded.filter((g) => g.periodId === "per-2026-1" || g.periodId === "per-2025-2");
check("el estudiante tiene historial con notas", historical.length === 7, `(${historical.length})`);
check("6 aprobadas y 1 reprobada en el historial", historical.filter((g) => g.approved).length === 6, `(${historical.filter((g) => g.approved).length})`);
const avg = gradeAverage(valentina.id);
check("el promedio ponderado está entre 3.0 y 4.5", avg > 3 && avg < 4.5, avg.toFixed(3));
const progress = graduationProgress(valentina.id, "prog-sistemas");
const totalCredits = sistemasCourses.reduce((s, c) => s + c.credits, 0);
check("el avance coincide con los créditos del pensum", progress.totalCredits === totalCredits, `${progress.earnedCredits}/${progress.totalCredits}`);
check("lista las obligatorias pendientes", progress.pendingRequired.length > 0, `(${progress.pendingRequired.length})`);

console.log("\n--- 2. Sistema de tareas y nota final ponderada ---");
const testOffering = offeringOf("ISI-302");
const sheet = gradingSheet(testOffering.id, listAllEnrollments());
check("la materia tiene roster de estudiantes", sheet.roster.length > 0, `(${sheet.roster.length})`);
check("la materia tiene tareas con peso", sheet.assignments.length === 3, `(${sheet.assignments.length})`);
check("los pesos suman 100%", sheet.totalWeight === 100, `${sheet.totalWeight}%`);
check("las tareas traen notas de los alumnos", sheet.assignments[0].gradedCount > 0, `(${sheet.assignments[0].gradedCount})`);

// Crear una tarea nueva y eliminarla: comprueba el ciclo de vida.
const created = createAssignment({ offeringId: testOffering.id, title: "Examen final", weight: 100 });
check("se puede crear una tarea", created.ok === true);
const createdId = created.ok ? created.assignment.id : "";
check("la tarea suma su porcentaje al peso total", totalWeightOf(testOffering.id) === 200, `${totalWeightOf(testOffering.id)}%`);
deleteAssignment(createdId);
check("al eliminar la tarea vuelve el peso original", totalWeightOf(testOffering.id) === 100, `${totalWeightOf(testOffering.id)}%`);

// Calificar la última tarea pendiente oficializa la nota final.
const pending = sheet.roster.find(
  (student) => sheet.assignments.some((a) => student.taskGrades[a.id] === undefined),
);
check("hay al menos un estudiante con tareas sin calificar", Boolean(pending));
if (pending) {
  const enrollment = listAllEnrollments().find(
    (e) => e.studentId === pending.studentId && e.offeringId === testOffering.id,
  );
  const missing = sheet.assignments.find((a) => pending.taskGrades[a.id] === undefined);
  const avgBefore = gradeAverage(pending.studentId);
  setAssignmentGrade({
    assignmentId: missing.id,
    studentId: pending.studentId,
    enrollmentId: enrollment.id,
    value: 4.0,
  });
  const finalGrade = listAllEnrollments().find((e) => e.id === enrollment.id).grade;
  check("al calificar todas las tareas se oficializa la nota final", finalGrade !== undefined, `(${finalGrade})`);
  check("el promedio del estudiante se actualiza", gradeAverage(pending.studentId) !== avgBefore, `${avgBefore.toFixed(2)} -> ${gradeAverage(pending.studentId).toFixed(2)}`);

  // Reprobar: una nota baja deja la materia reprobada y sin créditos.
  setAssignmentGrade({
    assignmentId: missing.id,
    studentId: pending.studentId,
    enrollmentId: enrollment.id,
    value: 1.0,
  });
  const failed = listAllEnrollments().find((e) => e.id === enrollment.id);
  check("una nota baja reproba la materia", failed.grade < MIN_GRADE, `(${failed.grade})`);
  const failedProgress = graduationProgress(pending.studentId, "prog-sistemas");
  check("la materia reprobada no suma créditos", failedProgress.failedCourses >= 1, `(${failedProgress.failedCourses})`);
  check("la materia reprobada queda pendiente para graduarse", failedProgress.pendingRequired.some((c) => c.id === pendingCourseId(pending.studentId, testOffering.id)));
}

console.log("\n--- 3. Prerrequisitos ---");
// ISI-601 exige ISI-501, que la estudiante nunca ha cursado: bloqueo determinista.
const offering601 = offeringOf("ISI-601");
const eval601 = evaluateEnrollment(valentina.id, offering601.id);
check("ISI-601 se bloquea por prerrequisito", eval601.ok === false && eval601.reason === "prerrequisitos", eval601.message);
check("el mensaje nombra la materia faltante", eval601.missing.some((c) => c.code === "ISI-501"));
const eval302 = evaluateEnrollment(valentina.id, offeringOf("ISI-302").id);
check("una materia ya matriculada no se vuelve a matricular", eval302.ok === false && eval302.reason === "ya-matriculada", eval302.message);

// Una materia sin prerrequisitos de semesters previos queda disponible.
const eval201 = evaluateEnrollment(valentina.id, offeringOf("ISI-201").id);
check("una materia ya aprobada no se puede repetir", eval201.ok === false, eval201.message);

console.log("\n--- 4. Lista de espera y promoción automática ---");
const offering303 = offeringOf("ISI-303");
const eval303 = evaluateEnrollment(valentina.id, offering303.id);
check("ISI-303 se evalúa sin cupos", eval303.ok === false && eval303.reason === "sin-cupos", eval303.message);
const wait = enrollInWaitlist({
  studentId: valentina.id,
  studentEmail: valentina.email,
  studentName: `${valentina.firstName} ${valentina.lastName}`,
  offeringId: offering303.id,
});
check("el estudiante entra a la lista de espera", wait.ok === true && wait.position === 1, JSON.stringify(wait));
const peerEnrollment = getActiveEnrollments(mateo.id, "per-2026-2").find((e) => e.offeringId === offering303.id);
check("el compañero ocupa el único cupo", Boolean(peerEnrollment));
cancel(peerEnrollment.id);
const promoted = getActiveEnrollments(valentina.id, "per-2026-2").find((e) => e.offeringId === offering303.id);
check("al liberarse el cupo el estudiante es promovido", Boolean(promoted));
check("la entrada queda en estado Promovido", getWaitlistForStudent(valentina.id)[0]?.status === "Promovido");

console.log("\n--- 5. Notificaciones del ciclo ---");
const notifs = listActiveNotificationsFor("Estudiante", valentina.id);
check("el estudiante recibió notificaciones", notifs.length > 0, `(${notifs.length})`);
check("hay aviso de cupo liberado", notifs.some((n) => n.title.includes("Cupo liberado")));
check("hay aviso de lista de espera", notifs.some((n) => n.title.includes("lista de espera")));
const staffNotifs = listActiveNotificationsFor("Staff", staff.id);
check("el Staff ve el aviso de solicitudes", staffNotifs.length > 0, `(${staffNotifs.length})`);

console.log("\n--- 6. Vista del estudiante ---");
const details = studentCourseDetails(valentina.id);
check("el estudiante ve el detalle de sus materias", details.length > 0, `(${details.length})`);
const withTasks = details.filter((d) => d.tasks.length > 0);
check("las tareas se ven con su porcentaje", withTasks.length > 0, `(${withTasks.length})`);
check("el desglose suma el peso de las tareas", withTasks.every((d) => d.weightTotal === 100));

console.log(failures === 0 ? "\nTODAS LAS VERIFICACIONES PASARON" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
