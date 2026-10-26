/**
 * Prueba de render: simula el DOM mínimo que usa la app y comprueba que las
 * vistas nuevas generan el HTML esperado sin lanzar errores.
 *   npx esbuild verify-render.mjs --bundle --platform=node --format=esm --outfile=verify-render-tmp.mjs && node verify-render-tmp.mjs
 */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

const rendered = { html: "" };
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.location = { hash: "" };
globalThis.window = { addEventListener: () => {} };
globalThis.document = {
  querySelector: (selector) => {
    if (selector === "#app") {
      return {
        set innerHTML(value) { rendered.html = value; },
        get innerHTML() { return rendered.html; },
      };
    }
    return null;
  },
  querySelectorAll: () => [],
};

const { seed } = await import("./src/data/seed.ts");
await seed();

const { getAccounts } = await import("./src/services/auth.service.ts");
const { renderStudentGradesView } = await import("./src/views/student-grades.view.ts");
const { renderGradingView } = await import("./src/views/grading.view.ts");
const { renderHistoryView } = await import("./src/views/history.view.ts");
const { renderAdminView } = await import("./src/views/admin.view.ts");
const { renderNotificationsView } = await import("./src/views/notifications.view.ts");
const { renderCourseRegistrationView } = await import("./src/views/course-registration.view.ts").catch(() => ({}));
const { listAllEnrollments } = await import("./src/services/enrollment.service.ts");
const { getOfferingsByPeriod, getCourse } = await import("./src/services/catalog.service.ts");

let failures = 0;
function check(label, ok, extra = "") {
  const okFinal = Boolean(ok);
  if (!okFinal) failures += 1;
  console.log(`${okFinal ? "PASS" : "FAIL"}  ${label}${extra ? ` -> ${extra}` : ""}`);
}

const accounts = getAccounts();
const valentina = accounts.find((a) => a.email === "valentina.rojas@unac.edu.co");
const staff = accounts.find((a) => a.email === "admisiones@unac.edu.co");

console.log("\n--- Vista del estudiante: #grades ---");
renderStudentGradesView(valentina);
let html = rendered.html;
check("renderiza el encabezado", html.includes("Mis calificaciones"));
check("muestra el resumen de calificaciones", html.includes("promedio ponderado"));
check("lista las materias del estudiante", (html.match(/enrollment-card/g) ?? []).length > 0);
check("muestra los porcentajes de cada tarea", html.includes("%"));
check("señala el avance al grado", html.includes("avance al grado"));

console.log("\n--- Vista del estudiante: #history ---");
renderHistoryView(valentina);
html = rendered.html;
check("renderiza el historial", html.includes("Historial acad"));
check("incluye la barra de progreso", html.includes("progress-bar"));
check("muestra el avance con porcentaje", /\d+%/.test(html));
check("lista las obligatorias pendientes", html.includes("pendientes") || html.includes("Obligatorias pendientes") || html.includes("Materias obligatorias pendientes"));

console.log("\n--- Vista del estudiante: #registration ---");
const { renderRegistrationView } = await import("./src/views/course-registration.view.ts");
renderRegistrationView(valentina);
html = rendered.html;
check("renderiza la matrícula", html.includes("Matr"));
check("muestra los prerrequisitos de las materias", html.includes("Prerrequisitos:"));
check("marca las materias bloqueadas", html.includes("enrollment-blocked"));
check("ofrece la lista de espera", html.includes("lista de espera"));

console.log("\n--- Vista del staff: #grading ---");
renderGradingView(staff, new URLSearchParams());
html = rendered.html;
check("renderiza la vista de tareas", html.includes("Tareas y calificaciones"));
check("ofrece el selector de materia", html.includes("course-picker"));
const offerings = getOfferingsByPeriod("per-2026-2");
const withStudents = offerings.find((o) =>
  listAllEnrollments().some((e) => e.offeringId === o.id && e.status !== "Cancelada"),
);
renderGradingView(staff, new URLSearchParams(`o=${withStudents.id}`));
html = rendered.html;
check("muestra la hoja de calificación", html.includes("grading-table"));
check("lista el roster de estudiantes", (html.match(/data-task-grade=/g) ?? []).length > 0);
check("muestra el peso de cada tarea", html.includes("Peso"));
check("permite agregar una tarea", html.includes("assignment-form"));
check("permite quitar estudiantes", html.includes("data-unenroll"));
check("permite inscribir estudiantes", html.includes("add-student"));
check("muestra el peso total asignado", html.includes("peso asignado"));

// Si el peso se pasa de 100% debe aparecer el aviso.
const { createAssignment } = await import("./src/services/assignments.service.ts");
const extra = createAssignment({ offeringId: withStudents.id, title: "Examen oral", weight: 100 });
check("se puede crear una tarea para la prueba", extra.ok === true);
renderGradingView(staff, new URLSearchParams(`o=${withStudents.id}`));
html = rendered.html;
check("avisa si el peso total se pasa de 100%", html.includes("Peso total"), "");

console.log("\n--- Vista del staff: #admin ---");
renderAdminView(staff);
html = rendered.html;
check("renderiza el panel", html.includes("Panel de control"));
check("enlaza a la vista de tareas", html.includes("#grading"));

console.log("\n--- Vista de notificaciones ---");
renderNotificationsView(valentina);
html = rendered.html;
check("renderiza la bandeja", html.includes("Bandeja de notificaciones"));

console.log(failures === 0 ? "\nTODAS LAS VERIFICACIONES DE RENDER PASARON" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
