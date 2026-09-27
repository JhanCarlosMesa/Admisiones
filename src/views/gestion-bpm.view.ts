import type { Account, Course, CourseType, Program } from "../types";
import { renderShell } from "../utils/dom";
import { listAll as listAllApplications, listByApplicant } from "../services/admissions.service";
import { listAllProgramChanges } from "../services/program-changes.service";
import { listAllPrerequisites } from "../services/prerequisites.service";
import { listAllEvents } from "../services/events.service";
import { listAllFaq } from "../services/content.service";
import {
  getActivePeriod,
  getCoursesByProgram,
  getOfferingsByPeriod,
  getProgram,
  getPrograms,
} from "../services/catalog.service";
import {
  availableSeats,
  creditsInUse,
  listAllEnrollments,
  occupiedSeats,
  MAX_CREDITS_PER_PERIOD,
} from "../services/enrollment.service";

// ------------------------------------------------------------
// Constantes del módulo
// ------------------------------------------------------------

type TabId =
  | "tab-resumen"
  | "tab-indicadores"
  | "tab-programas"
  | "tab-procesos"
  | "tab-reglas";

const TABS: { id: TabId; label: string }[] = [
  { id: "tab-resumen", label: "Resumen" },
  { id: "tab-indicadores", label: "Indicadores" },
  { id: "tab-programas", label: "Programas" },
  { id: "tab-procesos", label: "Procesos" },
  { id: "tab-reglas", label: "Reglas y mejora" },
];

// Costo por crédito por programa (COP, valores referenciales 2026).
// Coincide con la calculadora pública de admisiones.
const COST_PER_CREDIT: Record<string, number> = {
  "prog-admin": 280000,
  "prog-sistemas": 340000,
  "prog-contaduria": 260000,
  "prog-educacion": 220000,
  "prog-psicologia": 290000,
  "prog-enfermeria": 310000,
  "prog-comunicacion": 270000,
  "prog-industrial": 320000,
  "prog-derecho": 300000,
  "prog-teologia": 200000,
};

// Cupo máximo sembrado por oferta (de seed.ts).
const CAPACITY_PER_OFFERING = 25;

// Mínimo propuesto de estudiantes para abrir un programa o cohorte.
// 12 = 48% del cupo máximo de 25 — valor provisional recomendado por
// el análisis BPM (sección 8 del documento), sujeto a validación.
const MIN_ENROLLMENT_TO_OPEN = 12;

// ------------------------------------------------------------
// Utilidades de formato
// ------------------------------------------------------------

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function pct(num: number, denom: number, digits = 1): string {
  if (!denom) return "—";
  return `${(num / denom * 100).toFixed(digits)}%`;
}

function pctNum(num: number, denom: number): number {
  if (!denom) return 0;
  return (num / denom) * 100;
}

function round1(n: number): string {
  return n.toFixed(1);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function summaryCard(value: string, label: string): string {
  return `<div><b>${value}</b><span>${label}</span></div>`;
}

function kpiBlock(
  eyebrow: string,
  title: string,
  cards: { value: string; label: string }[],
  note?: string,
): string {
  return `<div style="margin-bottom:32px;">
    <div class="section-heading"><span>${eyebrow}</span><div><h3 style="font-family:var(--font-display);font-size:20px;color:var(--navy-900);margin:0 0 4px;">${title}</h3></div></div>
    <div class="pensum-summary" style="grid-template-columns:repeat(${cards.length},1fr);">
      ${cards.map((c) => summaryCard(c.value, c.label)).join("")}
    </div>
    ${note ? `<p class="table-note" style="margin-top:10px;">${note}</p>` : ""}
  </div>`;
}

// ------------------------------------------------------------
// Header y tabs
// ------------------------------------------------------------

function renderHero(): string {
  return `<header class="pensum-page-header" style="margin-bottom:28px;">
    <span class="eyebrow" style="color:var(--gold-500);">Indicadores de gesti&oacute;n</span>
    <h1>As&iacute; administramos el portal de admisiones y matr&iacute;cula</h1>
    <p class="pensum-page-subtitle">Aqu&iacute; encuentras los indicadores en vivo, los requisitos por carrera, el mapa completo de los procesos clave y las reglas que rigen el sistema. Los datos se calculan desde el navegador cada vez que abres una secci&oacute;n.</p>
  </header>`;
}

function renderHeroForAspirante(): string {
  return `<header class="pensum-page-header" style="margin-bottom:28px;">
    <span class="eyebrow" style="color:var(--gold-500);">Tu camino como aspirante</span>
    <h1>&iquest;Qu&eacute; necesitas para inscribirte en la UNAC?</h1>
    <p class="pensum-page-subtitle">Aqu&iacute; encuentras los requisitos, el paso a paso del proceso de admisi&oacute;n y los recursos de apoyo que tienes a tu disposici&oacute;n.</p>
  </header>`;
}

function renderHeroForEstudiante(program: Program | undefined): string {
  const title = program ? program.name : "tu programa acad&eacute;mico";
  return `<header class="pensum-page-header" style="margin-bottom:28px;">
    <span class="eyebrow" style="color:var(--gold-500);">Tu camino como estudiante</span>
    <h1>${title ? "Bienvenido a " + title : "Tu portal como estudiante"}</h1>
    <p class="pensum-page-subtitle">Aqu&iacute; encuentras c&oacute;mo matricular materias, cambiar de carrera, homologar contenidos externos y los requisitos que debes cumplir para graduarte.</p>
  </header>`;
}

function renderTabs(active: TabId): string {
  const buttons = TABS.map(
    (t) =>
      `<button class="faq-tab ${t.id === active ? "active" : ""}" data-tab="${t.id}" type="button" role="tab">${t.label}</button>`,
  ).join("");
  return `<div class="faq-categories" role="tablist" style="justify-content:center;margin-bottom:32px;">${buttons}</div>`;
}

// ============================================================
// TAB 1: RESUMEN
// ============================================================

function renderResumen(): string {
  const programs = getPrograms();
  const totalCourses = programs.reduce(
    (acc, p) => acc + getCoursesByProgram(p.id).length,
    0,
  );
  const alcance = [
    "Registro de cuenta y selecci&oacute;n del programa acad&eacute;mico de tu inter&eacute;s.",
    "Radicaci&oacute;n de la solicitud de admisi&oacute;n y seguimiento del estado hasta la decisi&oacute;n final.",
    "Matr&iacute;cula de materias por periodo, con validaci&oacute;n autom&aacute;tica de cr&eacute;ditos, horarios y cupos.",
    "Cambio de programa acad&eacute;mico para estudiantes activos.",
    "Homologaci&oacute;n de materias cursadas en otras instituciones.",
    "Panel de staff para tomar decisiones sobre admisiones, cambios y homologaciones.",
    "Contenido institucional: cat&aacute;logo de carreras, eventos, testimonios y preguntas frecuentes.",
  ];

  const roles = [
    {
      rol: "Aspirante",
      descripcion: "Es el rol por defecto al registrarte. Puedes radicar tu solicitud de admisi&oacute;n y consultar su estado en cualquier momento.",
      vistas: "#register &middot; #enrollment &middot; #profile",
      badge: "Aspirante",
    },
    {
      rol: "Estudiante",
      descripcion: "Se asigna autom&aacute;ticamente cuando el equipo de admisiones aprueba tu solicitud. Puedes matricular materias, ver tu historial y declarar prerrequisitos.",
      vistas: "#registration &middot; #history &middot; #program-change &middot; #prerequisites",
      badge: "Estudiante",
    },
    {
      rol: "Staff",
      descripcion: "Cuenta institucional con acceso al panel de admisiones para revisar solicitudes, aprobar cambios de carrera y resolver homologaciones.",
      vistas: "#admin",
      badge: "Staff",
    },
  ];

  const estados = [
    { entidad: "Admisi&oacute;n", estados: "Radicada &rarr; En revisi&oacute;n &rarr; Admitido / Rechazado", nota: "Al ser Admitido, la cuenta pasa de Aspirante a Estudiante." },
    { entidad: "Matr&iacute;cula", estados: "Matriculada &rarr; Cancelada", nota: "Cancelar una materia libera el cupo." },
    { entidad: "Cambio de programa", estados: "Solicitada &rarr; En revisi&oacute;n &rarr; Aprobada / Rechazada", nota: "Decisi&oacute;n manual de Staff." },
    { entidad: "Homologaci&oacute;n", estados: "Pendiente &rarr; Aprobada / Rechazada", nota: "Decisi&oacute;n manual de Staff." },
    { entidad: "Token de recuperaci&oacute;n", estados: "Vigente &rarr; Usado / Expirado", nota: "Expira a los 30 minutos." },
  ];

  const actorCard = (rol: string, desc: string, vistas: string, badge: string) =>
    `<article style="border:none;padding:0;background:transparent;box-shadow:none;align-items:flex-start;text-align:left;">
      <span class="role-badge">${badge}</span>
      <h3 style="font-family:var(--font-display);font-size:22px;margin:10px 0 6px;color:var(--navy-900);">${rol}</h3>
      <p style="color:var(--muted);margin:0 0 12px;">${desc}</p>
      <small style="color:var(--muted-soft);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">${vistas}</small>
    </article>`;

  return `<div class="tab-panel">
    <div class="section-intro">
      <div>
        <span class="eyebrow">Panorama general</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">&iquest;Qu&eacute; hace este portal?</h2>
        <p class="section-lead">El portal acompa&ntilde;a al aspirante desde el registro hasta su graduaci&oacute;n. Estos son los n&uacute;meros base del sistema: <strong>${programs.length} programas</strong> con <strong>${totalCourses} materias</strong> publicadas, organizados por semestre, nivel y modalidad.</p>
      </div>
    </div>

    <div class="section-heading">
      <span>01</span>
      <div>
        <h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">&iquest;Qu&eacute; procesos cubre?</h2>
        <p class="section-lead" style="margin:0;">Estos son los procesos de negocio que el sistema soporta hoy.</p>
      </div>
    </div>
    <ul style="margin:0 0 36px 0;padding-left:22px;color:var(--ink);font-size:15.5px;line-height:1.7;">
      ${alcance.map((a) => `<li>${a}</li>`).join("")}
    </ul>

    <div class="section-heading">
      <span>02</span>
      <div>
        <h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">Los tres roles del sistema</h2>
        <p class="section-lead" style="margin:0;">Cada persona tiene un rol y unas vistas permitidas. El rol cambia solo cuando Staff decide <strong>Admitido</strong>.</p>
      </div>
    </div>
    <div class="profile-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:36px;">
      ${roles.map((r) => actorCard(r.rol, r.descripcion, r.vistas, r.badge)).join("")}
    </div>

    <div class="section-heading">
      <span>03</span>
      <div>
        <h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">Estados por entidad</h2>
        <p class="section-lead" style="margin:0;">El ciclo de vida formal de cada tr&aacute;mite. La columna &quot;transici&oacute;n&quot; indica si el cambio es autom&aacute;tico o requiere decisi&oacute;n humana.</p>
      </div>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Entidad</th><th>Estados</th><th>Transici&oacute;n</th></tr></thead>
        <tbody>
          ${estados.map((e) => `<tr><td><strong>${e.entidad}</strong></td><td>${e.estados}</td><td>${e.nota}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ============================================================
// TAB 2: INDICADORES (KPIs en vivo)
// ============================================================

interface KpiSnapshot {
  // Admisiones
  admTotal: number;
  admAdmitidos: number;
  admRechazados: number;
  admPendientes: number;
  admDecididas: number;
  admTiempoPromedioDias: number;
  admEficienciaRevisionPct: number;
  admPorPrograma: { programId: string; count: number; name: string }[];
  // Matrícula
  enrollActivePeriodId: string | null;
  enrollOcupacionPct: number;
  enrollCreditosUsoPct: number;
  enrollOfertasAgotadas: number;
  enrollOfertasTotal: number;
  enrollTasaCancelacionPct: number;
  // Cambios de programa y homologaciones
  pcPendientes: number;
  pcTotalDecided: number;
  pcTasaAprobacionPct: number;
  prTotal: number;
  prTasaAprobacionPct: number;
  // Académicos
  cargaDocenteProm: number;
  coberturaProgramasPct: number;
  // Contenido
  eventsOcupacion: { title: string; pct: number; enrolled: number; capacity: number; type: string; date: string }[];
  faqByCategory: { category: string; count: number }[];
  faqTotal: number;
}

function computeSnapshot(): KpiSnapshot {
  const apps = listAllApplications();
  const programs = getPrograms();
  const admTotal = apps.length;
  const admAdmitidos = apps.filter((a) => a.status === "Admitido").length;
  const admRechazados = apps.filter((a) => a.status === "Rechazado").length;
  const admPendientes = apps.filter(
    (a) => a.status === "Radicada" || a.status === "En revisión",
  ).length;
  const decided = apps.filter((a) => a.reviewedAt);
  const admDecididas = decided.length;
  const admTiempoPromedioDias =
    admDecididas === 0
      ? 0
      : mean(decided.map((a) => (Date.parse(a.reviewedAt!) - Date.parse(a.createdAt)) / 86_400_000));
  const admEficienciaRevisionPct = pctNum(admDecididas, admTotal);

  const programName = (id: string) => programs.find((p) => p.id === id)?.name ?? id;
  const grouped = new Map<string, number>();
  apps.forEach((a) => grouped.set(a.programId, (grouped.get(a.programId) ?? 0) + 1));
  const admPorPrograma = Array.from(grouped.entries())
    .map(([programId, count]) => ({ programId, count, name: programName(programId) }))
    .sort((a, b) => b.count - a.count);

  const activePeriod = getActivePeriod();
  const enrollActivePeriodId = activePeriod?.id ?? null;
  const offerings = activePeriod ? getOfferingsByPeriod(activePeriod.id) : [];
  const enrollOcupacionPct =
    offerings.length === 0 ? 0 : mean(offerings.map((o) => (occupiedSeats(o.id) / o.capacity) * 100));
  const enrollments = listAllEnrollments();
  const periodEnrollments = activePeriod ? enrollments.filter((e) => e.periodId === activePeriod.id) : [];
  const activeStudents = Array.from(
    new Set(periodEnrollments.filter((e) => e.status === "Matriculada").map((e) => e.studentId)),
  );
  const enrollCreditosUsoPct =
    activePeriod && activeStudents.length > 0
      ? mean(activeStudents.map((sid) => (creditsInUse(sid, activePeriod.id) / MAX_CREDITS_PER_PERIOD) * 100))
      : 0;
  const enrollOfertasAgotadas = offerings.filter((o) => availableSeats(o) <= 0).length;
  const enrollOfertasTotal = offerings.length;
  const periodCancelled = periodEnrollments.filter((e) => e.status === "Cancelada").length;
  const enrollTasaCancelacionPct = pctNum(periodCancelled, periodEnrollments.length);

  const programChanges = listAllProgramChanges();
  const pcDecided = programChanges.filter((s) => s.status === "Aprobada" || s.status === "Rechazada");
  const pcTasaAprobacionPct = pctNum(
    programChanges.filter((s) => s.status === "Aprobada").length,
    pcDecided.length,
  );
  const pcPendientes = programChanges.filter((s) => s.status === "Solicitada" || s.status === "En revisión").length;
  const pcTotalDecided = pcDecided.length;
  const prereqs = listAllPrerequisites();
  const prTotal = prereqs.length;
  const prTasaAprobacionPct = pctNum(prereqs.filter((s) => s.status === "Aprobada").length, prTotal);

  // Académicos: carga docente promedio y cobertura de programas
  const cargaDocenteProm =
    offerings.length === 0
      ? 0
      : (() => {
          const byProf = new Map<string, number>();
          offerings.forEach((o) => byProf.set(o.professor, (byProf.get(o.professor) ?? 0) + 1));
          return mean(Array.from(byProf.values()));
        })();
  const programsWithApps = new Set(apps.map((a) => a.programId));
  const coberturaProgramasPct = programs.length === 0 ? 0 : (programsWithApps.size / programs.length) * 100;

  const events = listAllEvents();
  const eventsOcupacion = events.map((e) => ({
    title: e.title,
    pct: e.capacity === 0 ? 0 : (e.enrolled / e.capacity) * 100,
    enrolled: e.enrolled,
    capacity: e.capacity,
    type: e.type,
    date: e.date,
  }));

  const faq = listAllFaq();
  const faqByCategoryMap = new Map<string, number>();
  faq.forEach((f) => faqByCategoryMap.set(f.category, (faqByCategoryMap.get(f.category) ?? 0) + 1));
  const faqByCategory = Array.from(faqByCategoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return {
    admTotal,
    admAdmitidos,
    admRechazados,
    admPendientes,
    admDecididas,
    admTiempoPromedioDias,
    admEficienciaRevisionPct,
    admPorPrograma,
    enrollActivePeriodId,
    enrollOcupacionPct,
    enrollCreditosUsoPct,
    enrollOfertasAgotadas,
    enrollOfertasTotal,
    enrollTasaCancelacionPct,
    pcPendientes,
    pcTotalDecided,
    pcTasaAprobacionPct,
    prTotal,
    prTasaAprobacionPct,
    cargaDocenteProm,
    coberturaProgramasPct,
    eventsOcupacion,
    faqByCategory,
    faqTotal: faq.length,
  };
}

function renderIndicadores(): string {
  const s = computeSnapshot();

  const admCards = [
    { value: pct(s.admAdmitidos, s.admTotal, 1), label: "Tasa de admisi&oacute;n" },
    { value: String(s.admPendientes), label: "Solicitudes por revisar" },
    { value: s.admTiempoPromedioDias > 0 ? `${round1(s.admTiempoPromedioDias)} d` : "—", label: "Tiempo promedio de respuesta" },
    { value: pct(s.admDecididas, s.admTotal), label: "Eficiencia de revisi&oacute;n" },
  ];
  const matCards = s.enrollActivePeriodId
    ? [
        { value: `${s.enrollOcupacionPct.toFixed(1)}%`, label: "Ocupaci&oacute;n de cupos" },
        { value: `${s.enrollCreditosUsoPct.toFixed(1)}%`, label: "Uso del l&iacute;mite de cr&eacute;ditos" },
        { value: `${s.enrollOfertasAgotadas}/${s.enrollOfertasTotal}`, label: "Cursos sin cupos" },
        { value: `${s.enrollTasaCancelacionPct.toFixed(1)}%`, label: "Tasa de cancelaci&oacute;n" },
      ]
    : [
        { value: "—", label: "Ocupaci&oacute;n de cupos" },
        { value: "—", label: "Uso del l&iacute;mite de cr&eacute;ditos" },
        { value: "—", label: "Cursos sin cupos" },
        { value: "—", label: "Tasa de cancelaci&oacute;n" },
      ];
  const acadCards = [
    { value: s.cargaDocenteProm > 0 ? `${round1(s.cargaDocenteProm)}` : "—", label: "Cursos por docente (prom.)" },
    { value: `${s.coberturaProgramasPct.toFixed(0)}%`, label: "Cobertura de programas" },
    { value: s.admDecididas > 0 ? `${s.admRechazados}` : "—", label: "Solicitudes rechazadas" },
  ];
  const camCards = [
    { value: s.pcTotalDecided > 0 ? `${s.pcTasaAprobacionPct.toFixed(1)}%` : "—", label: "Aprobaci&oacute;n cambios de carrera" },
    { value: String(s.pcPendientes), label: "Cambios por revisar" },
    { value: s.prTotal > 0 ? `${s.prTasaAprobacionPct.toFixed(1)}%` : "—", label: "Aprobaci&oacute;n homologaciones" },
  ];

  const programRows = s.admPorPrograma
    .map(
      (p) =>
        `<tr><td><strong>${p.name}</strong></td><td>${p.count}</td><td>${p.count > 0 ? Math.round((p.count / s.admTotal) * 100) : 0}%</td></tr>`,
    )
    .join("");

  const eventRows = s.eventsOcupacion
    .map((e) => {
      const fecha = new Date(e.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
      const badge = e.pct >= 50 ? '<span class="status-badge status-good">Cumple</span>' : '<span class="status-badge status-warn">Por debajo</span>';
      return `<tr><td>${e.title}<br><small style="color:var(--muted-soft);">${e.type} &middot; ${fecha}</small></td><td>${e.enrolled} / ${e.capacity}</td><td><strong>${e.pct.toFixed(1)}%</strong></td><td>${badge}</td></tr>`;
    })
    .join("");

  const faqRows = s.faqByCategory
    .map((c) => `<tr><td>${c.category}</td><td>${c.count}</td><td>${s.faqTotal > 0 ? Math.round((c.count / s.faqTotal) * 100) : 0}%</td></tr>`)
    .join("");

  return `<div class="tab-panel">
    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">En vivo</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Indicadores del sistema</h2>
        <p class="section-lead">Los n&uacute;meros se recalculan cada vez que abres esta secci&oacute;n a partir de los datos guardados en el navegador. Las metas sugeridas son un punto de partida que debe validar el &aacute;rea acad&eacute;mica.</p>
      </div>
    </div>

    ${kpiBlock("A", "Admisiones", admCards, "Meta sugerida: admisi&oacute;n &ge; 60% &middot; pendientes &lt; 15 &middot; respuesta &le; 5 d&iacute;as h&aacute;biles.")}
    ${s.admPorPrograma.length > 0 ? `<div class="table-scroll" style="margin-bottom:36px;">
      <h4 style="font-family:var(--font-display);font-size:17px;color:var(--navy-900);margin:0 0 12px;">Solicitudes por carrera</h4>
      <table class="data-table">
        <thead><tr><th>Programa</th><th>Solicitudes</th><th>% del total</th></tr></thead>
        <tbody>${programRows}</tbody>
      </table>
    </div>` : ""}

    ${kpiBlock("B", "Matr&iacute;cula", matCards, s.enrollActivePeriodId ? `Calculado sobre el periodo activo <strong>${s.enrollActivePeriodId}</strong>.` : "Sin periodo activo configurado.")}
    ${kpiBlock("C", "Indicadores acad&eacute;micos", acadCards)}
    ${kpiBlock("D", "Cambios de carrera y homologaciones", camCards)}

    <div style="margin-bottom:32px;">
      <div class="section-heading"><span>E</span><div><h3 style="font-family:var(--font-display);font-size:20px;color:var(--navy-900);margin:0 0 4px;">Eventos y contenido</h3></div></div>
      <div class="pensum-summary" style="grid-template-columns:1fr 1fr;">
        <div><b>${s.eventsOcupacion.length}</b><span>Eventos publicados</span></div>
        <div><b>${s.faqTotal}</b><span>&Iacute;tems de FAQ activos</span></div>
      </div>
    </div>

    ${s.eventsOcupacion.length > 0 ? `<div class="table-scroll" style="margin-bottom:32px;">
      <h4 style="font-family:var(--font-display);font-size:17px;color:var(--navy-900);margin:0 0 12px;">Ocupaci&oacute;n de eventos (meta &ge; 50%)</h4>
      <table class="data-table">
        <thead><tr><th>Evento</th><th>Inscritos / cupo</th><th>% ocupaci&oacute;n</th><th>Estado</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>
    </div>` : ""}

    <div class="table-scroll">
      <h4 style="font-family:var(--font-display);font-size:17px;color:var(--navy-900);margin:0 0 12px;">Preguntas frecuentes por categor&iacute;a</h4>
      <table class="data-table">
        <thead><tr><th>Categor&iacute;a</th><th>&Iacute;tems</th><th>% del total</th></tr></thead>
        <tbody>${faqRows || '<tr><td colspan="3" style="text-align:center;color:var(--muted);">A&uacute;n no hay FAQ sembrados.</td></tr>'}</tbody>
      </table>
      <p class="table-note">El sistema no registra las b&uacute;squedas que hace cada usuario, por lo que este indicador es informativo. Un backend permitir&iacute;a medir el alcance real de cada categor&iacute;a.</p>
    </div>
  </div>`;
}

// ============================================================
// TAB 3: PROGRAMAS (presupuesto, requisitos, apertura)
// ============================================================

interface ProgramStats {
  program: Program;
  courses: Course[];
  totalCourses: number;
  totalCredits: number;
  totalHours: number;
  semesters: number;
  creditsByType: Record<CourseType, number>;
  coursesByType: Record<CourseType, number>;
  costPerCredit: number;
  totalCost: number;
  costPerSemester: number;
  admitted: number;
  pending: number;
  rejected: number;
  totalDemand: number;
  openingStatus: "ok" | "warning" | "danger";
  statusLabel: string;
}

function emptyByType(): Record<CourseType, number> {
  return { Obligatoria: 0, Electiva: 0, Práctica: 0, "Trabajo de grado": 0, Cátedra: 0 };
}

function computeProgramStats(program: Program, apps: ReturnType<typeof listAllApplications>): ProgramStats {
  const courses = getCoursesByProgram(program.id);
  const totalCourses = courses.length;
  const totalCredits = courses.reduce((acc, c) => acc + c.credits, 0);
  const totalHours = courses.reduce((acc, c) => acc + c.hours, 0);
  const semesters = courses.length === 0 ? 0 : Math.max(...courses.map((c) => c.semester));

  const creditsByType = emptyByType();
  const coursesByType = emptyByType();
  for (const c of courses) {
    creditsByType[c.type] = (creditsByType[c.type] ?? 0) + c.credits;
    coursesByType[c.type] = (coursesByType[c.type] ?? 0) + 1;
  }

  const costPerCredit = COST_PER_CREDIT[program.id] ?? 250000;
  const totalCost = totalCredits * costPerCredit;
  const costPerSemester = semesters === 0 ? 0 : totalCost / semesters;

  const programApps = apps.filter((a) => a.programId === program.id);
  const admitted = programApps.filter((a) => a.status === "Admitido").length;
  const pending = programApps.filter((a) => a.status === "Radicada" || a.status === "En revisión").length;
  const rejected = programApps.filter((a) => a.status === "Rechazado").length;
  const totalDemand = programApps.length;

  let openingStatus: "ok" | "warning" | "danger" = "danger";
  let statusLabel = `Sin admitidos (m&iacute;nimo ${MIN_ENROLLMENT_TO_OPEN})`;
  if (admitted >= MIN_ENROLLMENT_TO_OPEN) {
    openingStatus = "ok";
    statusLabel = `Abrible (${admitted} &ge; ${MIN_ENROLLMENT_TO_OPEN})`;
  } else if (admitted >= Math.ceil(MIN_ENROLLMENT_TO_OPEN / 2)) {
    openingStatus = "warning";
    statusLabel = `En riesgo (${admitted} &lt; ${MIN_ENROLLMENT_TO_OPEN})`;
  }

  return {
    program,
    courses,
    totalCourses,
    totalCredits,
    totalHours,
    semesters,
    creditsByType,
    coursesByType,
    costPerCredit,
    totalCost,
    costPerSemester,
    admitted,
    pending,
    rejected,
    totalDemand,
    openingStatus,
    statusLabel,
  };
}

function renderProgramCard(stats: ProgramStats): string {
  const p = stats.program;
  const statusBadge = {
    ok: '<span class="status-badge status-good">Abrible</span>',
    warning: '<span class="status-badge status-warn">En riesgo</span>',
    danger: '<span class="status-badge status-bad">Sin cohorte</span>',
  }[stats.openingStatus];

  return `<article class="pensum-semester-card" style="margin-bottom:22px;">
    <header class="pensum-semester-header">
      <div class="pensum-semester-number">
        <span class="pensum-semester-num" style="font-size:18px;padding:8px 14px;">${p.id.replace("prog-", "").slice(0, 4).toUpperCase()}</span>
        <span class="pensum-semester-label">${p.level} &middot; ${p.modality}</span>
      </div>
      <div style="flex:1;padding-left:18px;">
        <h3 style="font-family:var(--font-display);font-size:22px;color:var(--navy-900);margin:0 0 4px;">${p.name}</h3>
        <p style="color:var(--muted);margin:0;font-size:14px;">${p.description}</p>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${statusBadge}
          <span class="status-badge status-neutral">${stats.totalCourses} materias</span>
          <span class="status-badge status-neutral">${stats.totalCredits} cr&eacute;ditos</span>
          <span class="status-badge status-neutral">${stats.semesters} semestres</span>
        </div>
      </div>
    </header>

    <div style="padding:24px 28px;">
      <div class="profile-stats" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
        <article style="padding:16px 12px;">
          <b style="font-size:20px;">${formatCOP(stats.costPerCredit)}</b>
          <span style="font-size:11px;">por cr&eacute;dito</span>
        </article>
        <article style="padding:16px 12px;">
          <b style="font-size:20px;">${formatCOP(stats.totalCost)}</b>
          <span style="font-size:11px;">costo total del programa</span>
        </article>
        <article style="padding:16px 12px;">
          <b style="font-size:20px;">${formatCOP(Math.round(stats.costPerSemester))}</b>
          <span style="font-size:11px;">costo por semestre (prom.)</span>
        </article>
        <article style="padding:16px 12px;">
          <b style="font-size:20px;">${stats.totalHours} h</b>
          <span style="font-size:11px;">horas totales</span>
        </article>
      </div>

      <div class="section-heading" style="margin-bottom:14px;">
        <span>R</span>
        <div>
          <h4 style="font-family:var(--font-display);font-size:17px;color:var(--navy-900);margin:0;">Requisitos para graduarte</h4>
          <p style="margin:4px 0 0;color:var(--muted);font-size:13.5px;">Composici&oacute;n del pensum por tipo de materia.</p>
        </div>
      </div>
      <div class="table-scroll" style="margin-bottom:20px;">
        <table class="data-table">
          <thead><tr><th>Tipo de materia</th><th>Cantidad</th><th>Cr&eacute;ditos</th><th>% del total</th></tr></thead>
          <tbody>
            ${(["Obligatoria", "Electiva", "Práctica", "Trabajo de grado", "Cátedra"] as CourseType[])
              .map((t) => {
                const c = stats.coursesByType[t] ?? 0;
                const cr = stats.creditsByType[t] ?? 0;
                if (c === 0) return "";
                const pct = stats.totalCredits > 0 ? Math.round((cr / stats.totalCredits) * 100) : 0;
                return `<tr><td><strong>${t}</strong></td><td>${c}</td><td>${cr}</td><td>${pct}%</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="section-heading" style="margin-bottom:14px;">
        <span>A</span>
        <div>
          <h4 style="font-family:var(--font-display);font-size:17px;color:var(--navy-900);margin:0;">Apertura y demanda</h4>
          <p style="margin:4px 0 0;color:var(--muted);font-size:13.5px;">Cu&aacute;ntos estudiantes hay en tr&aacute;mite y si alcanza el m&iacute;nimo propuesto de ${MIN_ENROLLMENT_TO_OPEN} para abrir cohorte.</p>
        </div>
      </div>
      <div class="profile-stats" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">
        <article style="padding:14px 10px;"><b style="font-size:22px;color:var(--green-700);">${stats.admitted}</b><span style="font-size:11px;">Admitidos</span></article>
        <article style="padding:14px 10px;"><b style="font-size:22px;color:var(--amber-700);">${stats.pending}</b><span style="font-size:11px;">En tr&aacute;mite</span></article>
        <article style="padding:14px 10px;"><b style="font-size:22px;color:var(--red-700);">${stats.rejected}</b><span style="font-size:11px;">Rechazados</span></article>
        <article style="padding:14px 10px;"><b style="font-size:22px;">${stats.totalDemand}</b><span style="font-size:11px;">Demanda total</span></article>
      </div>
      <p style="margin:0;color:var(--ink-soft);font-size:13.5px;"><strong>${stats.statusLabel}</strong></p>
    </div>
  </article>`;
}

function renderProgramas(): string {
  const programs = getPrograms();
  const apps = listAllApplications();
  const stats = programs.map((p) => computeProgramStats(p, apps));

  // Resumen agregado
  const totalCost = stats.reduce((acc, s) => acc + s.totalCost, 0);
  const totalAdmitted = stats.reduce((acc, s) => acc + s.admitted, 0);
  const totalDemand = stats.reduce((acc, s) => acc + s.totalDemand, 0);
  const openCount = stats.filter((s) => s.openingStatus === "ok").length;
  const warningCount = stats.filter((s) => s.openingStatus === "warning").length;
  const dangerCount = stats.filter((s) => s.openingStatus === "danger").length;

  return `<div class="tab-panel">
    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">Por carrera</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Presupuesto, requisitos y apertura</h2>
        <p class="section-lead">Aqu&iacute; ves por cada carrera cu&aacute;nto cuesta cursarla, qu&eacute; necesitas para graduarte y si la demanda actual alcanza el m&iacute;nimo propuesto de <strong>${MIN_ENROLLMENT_TO_OPEN} estudiantes admitidos</strong> para abrir cohorte.</p>
      </div>
    </div>

    <div class="pensum-summary" style="grid-template-columns:repeat(4,1fr);margin-bottom:36px;">
      <div><b>${programs.length}</b><span>Carreras publicadas</span></div>
      <div><b>${formatCOP(totalCost)}</b><span>Inversi&oacute;n si cursas todo el cat&aacute;logo</span></div>
      <div><b>${totalAdmitted}</b><span>Estudiantes admitidos</span></div>
      <div><b>${totalDemand}</b><span>Solicitudes totales</span></div>
    </div>

    <div class="section-heading" style="margin-bottom:18px;">
      <span>!</span>
      <div>
        <h3 style="font-family:var(--font-display);font-size:20px;color:var(--navy-900);margin:0 0 4px;">Estado de apertura por carrera</h3>
        <p style="margin:0;color:var(--muted);font-size:13.5px;">
          <span class="status-badge status-good" style="margin-right:4px;">Abrible</span> ${openCount} &middot;
          <span class="status-badge status-warn" style="margin:0 4px;">En riesgo</span> ${warningCount} &middot;
          <span class="status-badge status-bad" style="margin:0 4px;">Sin cohorte</span> ${dangerCount}
        </p>
      </div>
    </div>

    ${stats.map(renderProgramCard).join("")}

    <p class="table-note" style="margin-top:16px;">
      <strong>Nota:</strong> el m&iacute;nimo de ${MIN_ENROLLMENT_TO_OPEN} estudiantes es un valor provisional recomendado por el an&aacute;lisis BPM (48% del cupo m&aacute;ximo de ${CAPACITY_PER_OFFERING}). Est&aacute; sujeto a validaci&oacute;n por el comit&eacute; acad&eacute;mico.
    </p>
  </div>`;
}

// ============================================================
// TAB 4: PROCESOS (mapas detallados)
// ============================================================

function renderProcesos(): string {
  const procesos = [
    { nombre: "Inscripci&oacute;n (admisi&oacute;n)", disparador: "Registro del aspirante o radicaci&oacute;n de la solicitud", resultado: "Solicitud admitida o rechazada", duenio: "Aspirante &harr; Staff" },
    { nombre: "Matr&iacute;cula de materias", disparador: "Estudiante admitido en periodo activo", resultado: "Materias matriculadas dentro del l&iacute;mite de cr&eacute;ditos", duenio: "Estudiante (autoservicio)" },
    { nombre: "Cancelaci&oacute;n de matr&iacute;cula", disparador: "Estudiante solicita cancelar una materia", resultado: "Cupo liberado y registro en estado Cancelada", duenio: "Estudiante (autoservicio)" },
    { nombre: "Cambio de programa", disparador: "Estudiante con admisi&oacute;n aprobada", resultado: "Cambio aprobado o rechazado", duenio: "Estudiante &rarr; Staff" },
    { nombre: "Homologaci&oacute;n de prerrequisitos", disparador: "Declaraci&oacute;n de materia externa", resultado: "Homologaci&oacute;n aprobada o rechazada", duenio: "Estudiante &rarr; Staff" },
    { nombre: "Graduaci&oacute;n", disparador: "Estudiante completa el 100% del pensum", resultado: "Cumplimiento de requisitos de grado", duenio: "Estudiante &rarr; Staff acad&eacute;mico" },
    { nombre: "Recuperaci&oacute;n de contraseña", disparador: "Usuario olvida su clave", resultado: "Nueva contraseña definida", duenio: "Autoservicio (simulado)" },
  ];

  const inscripcionSteps = [
    "<strong>Registro:</strong> el aspirante crea su cuenta en <em>#register</em> eligiendo el programa acad&eacute;mico al que desea aplicar.",
    "<strong>Radicaci&oacute;n:</strong> completa el formulario en <em>#enrollment</em> con programa, nivel, ciudad, modalidad y una carta de motivaci&oacute;n.",
    "<strong>Validaci&oacute;n autom&aacute;tica:</strong> el sistema bloquea una nueva solicitud si ya existe una activa (estado distinto de <code>Rechazado</code>).",
    "<strong>Estado Radicada:</strong> la solicitud queda visible en el panel de Staff para su revisi&oacute;n.",
    "<strong>En revisi&oacute;n:</strong> Staff marca la solicitud como <code>En revisi&oacute;n</code> cuando empieza a evaluarla.",
    "<strong>Decisi&oacute;n:</strong> Staff emite <code>Admitido</code> o <code>Rechazado</code> con una nota de revisi&oacute;n.",
    "<strong>Promoci&oacute;n autom&aacute;tica:</strong> si la decisi&oacute;n es <code>Admitido</code>, el sistema cambia el rol de la cuenta de Aspirante a Estudiante.",
    "<strong>Notificaci&oacute;n al usuario:</strong> el aspirante o estudiante puede consultar el estado en cualquier momento desde <em>#enrollment</em>.",
    "<strong>Re-radicaci&oacute;n:</strong> si la solicitud fue rechazada, el aspirante puede iniciar un nuevo proceso.",
  ];

  const matriculaSteps = [
    "<strong>Verificaci&oacute;n de requisitos:</strong> el sistema exige admisi&oacute;n <code>Admitido</code> y un periodo acad&eacute;mico activo.",
    "<strong>Selecci&oacute;n de materias:</strong> el estudiante ingresa a <em>#registration</em> y ve el pensum de su programa filtrado por la oferta acad&eacute;mica (<code>CourseOffering</code>) del periodo activo.",
    "<strong>Validaci&oacute;n 1 - Duplicidad:</strong> no se permite matricular dos veces la misma materia en el periodo.",
    `<strong>Validaci&oacute;n 2 - L&iacute;mite de cr&eacute;ditos:</strong> el sistema suma los cr&eacute;ditos ya matriculados y bloquea si se superan los ${MAX_CREDITS_PER_PERIOD} permitidos.`,
    "<strong>Validaci&oacute;n 3 - Choque de horario:</strong> compara d&iacute;a y franja horaria contra las materias ya activas del estudiante.",
    "<strong>Validaci&oacute;n 4 - Cupo disponible:</strong> revisa que la oferta a&uacute;n tenga cupos libres.",
    "<strong>Registro:</strong> si pasa todas las validaciones, se crea el registro <code>Enrollment</code> con estado <code>Matriculada</code> y el cupo ocupado se recalcula en vivo.",
    "<strong>Confirmaci&oacute;n:</strong> el estudiante ve el resumen de su matr&iacute;cula y puede agregar m&aacute;s materias o finalizar.",
    "<strong>Cancelaci&oacute;n (proceso aparte):</strong> en cualquier momento el estudiante puede cancelar una materia, lo que libera el cupo para otros.",
  ];

  const cambioSteps = [
    "<strong>Estudiante con admisi&oacute;n aprobada</strong> solicita cambio de programa desde <em>#program-change</em>.",
    "<strong>Indica programa destino y motivo</strong> (m&iacute;nimo 40 caracteres explicando la raz&oacute;n del cambio).",
    "<strong>Validaci&oacute;n:</strong> el sistema bloquea una nueva solicitud si ya existe una en estado <code>Solicitada</code> o <code>En revisi&oacute;n</code>.",
    "<strong>Staff revisa</strong> la solicitud desde <em>#admin</em> y decide <code>Aprobada</code> o <code>Rechazada</code> con una nota.",
    "<strong>Hist&oacute;rico:</strong> el estudiante y Staff pueden consultar todas las solicitudes anteriores.",
  ];

  const homologacionSteps = [
    "<strong>El estudiante declara una materia externa</strong> con c&oacute;digo, nombre, instituci&oacute;n, a&ntilde;o, nota (0.0&ndash;5.0) y observaciones.",
    "<strong>El registro queda en estado <code>Pendiente</code></strong> hasta que Staff lo revise.",
    "<strong>Staff aprueba o rechaza</strong> desde el panel de administraci&oacute;n, con una nota de respuesta.",
    "<strong>El estudiante consulta el hist&oacute;rico</strong> de sus declaraciones y el estado de cada una.",
  ];

  const graduacionSteps = [
    "<strong>El estudiante revisa su avance</strong> en <em>#history</em>: debe tener el 100% de los cr&eacute;ditos del pensum en estado aprobado.",
    "<strong>Verifica requisitos espec&iacute;ficos:</strong> pr&aacute;ctica profesional completada y trabajo de grado sustentado (cuando aplique al programa).",
    "<strong>Declara materias externas</strong> si curs&oacute; contenidos en otras instituciones (proceso de homologaci&oacute;n).",
    "<strong>Staff acad&eacute;mico valida</strong> el cumplimiento final de requisitos.",
    "<strong>Certificaci&oacute;n:</strong> una vez verificado, se emite el acta de grado correspondiente.",
  ];

  const recoverySteps = [
    "<strong>El usuario solicita recuperaci&oacute;n</strong> desde <em>#recovery</em> con su correo.",
    "<strong>El sistema genera un token</strong> de un solo uso, v&aacute;lido por 30 minutos, asociado al correo (los tokens previos de ese correo se descartan).",
    "<strong>El sistema simula el env&iacute;o</strong> del enlace (no hay correo real). El enlace se muestra en pantalla.",
    "<strong>El usuario hace clic en el enlace</strong> y define una nueva contraseña; el token queda marcado como usado.",
  ];

  function stepCard(num: number, title: string, subtitle: string, steps: string[]): string {
    const items = steps.map((s) => `<li style="margin-bottom:10px;line-height:1.55;">${s}</li>`).join("");
    return `<details class="pensum-semester-card" style="margin-bottom:18px;" open>
      <summary style="list-style:none;cursor:pointer;outline:none;">
        <header class="pensum-semester-header" style="cursor:pointer;">
          <div class="pensum-semester-number">
            <span class="pensum-semester-num">${String(num).padStart(2, "0")}</span>
            <span class="pensum-semester-label">${subtitle}</span>
          </div>
          <h3 style="font-family:var(--font-display);font-size:20px;color:var(--navy-900);margin:0;flex:1;padding-left:18px;">${title}</h3>
        </header>
      </summary>
      <div style="padding:24px 28px;">
        <ol style="margin:0;padding-left:22px;color:var(--ink);font-size:15px;">${items}</ol>
      </div>
    </details>`;
  }

  return `<div class="tab-panel">
    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">Inventario</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Cat&aacute;logo de procesos</h2>
        <p class="section-lead">Estos son los siete procesos que el portal soporta. M&aacute;s abajo encuentras el paso a paso detallado de cada uno.</p>
      </div>
    </div>
    <div class="table-scroll" style="margin-bottom:40px;">
      <table class="data-table">
        <thead><tr><th>Proceso</th><th>Cu&aacute;ndo se dispara</th><th>Resultado esperado</th><th>Responsable</th></tr></thead>
        <tbody>
          ${procesos.map((p) => `<tr><td><strong>${p.nombre}</strong></td><td>${p.disparador}</td><td>${p.resultado}</td><td>${p.duenio}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">Mapas</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">C&oacute;mo funciona cada proceso</h2>
        <p class="section-lead">Haz clic en cualquier tarjeta para expandirla o colapsarla. Los pasos est&aacute;n ordenados de principio a fin.</p>
      </div>
    </div>
    ${stepCard(1, "Inscripci&oacute;n y admisi&oacute;n", "Aspirante &rarr; Staff", inscripcionSteps)}
    ${stepCard(2, "Matr&iacute;cula de materias", "Estudiante autoservicio", matriculaSteps)}
    ${stepCard(3, "Cambio de programa", "Estudiante &rarr; Staff", cambioSteps)}
    ${stepCard(4, "Homologaci&oacute;n de prerrequisitos externos", "Estudiante &rarr; Staff", homologacionSteps)}
    ${stepCard(5, "Graduaci&oacute;n", "Estudiante &rarr; Staff acad&eacute;mico", graduacionSteps)}
    ${stepCard(6, "Recuperaci&oacute;n de contraseña", "Autoservicio simulado", recoverySteps)}
  </div>`;
}

// ============================================================
// TAB 5: REGLAS Y MEJORA
// ============================================================

function recommendation(icon: string, title: string, body: string, variant: string): string {
  return `<div class="notification-item notification-${variant}" style="margin-bottom:14px;">
    <span class="notification-icon" aria-hidden="true">${icon}</span>
    <div>
      <strong style="display:block;margin-bottom:4px;">${title}</strong>
      <span style="color:var(--ink-soft);font-size:14.5px;line-height:1.6;">${body}</span>
    </div>
  </div>`;
}

function renderReglasYMejora(): string {
  const reglas = [
    { regla: "Cr&eacute;ditos m&aacute;ximos por periodo", valor: `M&aacute;ximo ${MAX_CREDITS_PER_PERIOD} cr&eacute;ditos`, ubicacion: "enrollment.service.ts &mdash; MAX_CREDITS_PER_PERIOD" },
    { regla: "Cupo por curso ofertado", valor: `${CAPACITY_PER_OFFERING} cupos por oferta`, ubicacion: "data/seed.ts &mdash; capacity" },
    { regla: "Duplicidad de matr&iacute;cula", valor: "No se permite matricular dos veces la misma materia en el mismo periodo", ubicacion: "enrollment.service.ts &mdash; enroll()" },
    { regla: "Choque de horario", valor: "Mismo d&iacute;a + solapamiento de franja horaria contra materias activas", ubicacion: "enrollment.service.ts &mdash; timesOverlap()" },
    { regla: "Solicitud de admisi&oacute;n &uacute;nica", valor: "No se permite nueva solicitud si hay una activa (estado distinto de Rechazado)", ubicacion: "admissions.service.ts &mdash; hasActiveApplication()" },
    { regla: "Cambio de programa &uacute;nico", valor: "No se permite nueva solicitud si hay una Solicitada o En revisi&oacute;n", ubicacion: "program-changes.service.ts &mdash; hasPendingProgramChange()" },
    { regla: "Motivo de cambio de carrera", valor: "M&iacute;nimo 40 caracteres", ubicacion: "program-change.view.ts" },
    { regla: "Promoci&oacute;n de rol", valor: "Aspirante &rarr; Estudiante al ser admitido", ubicacion: "admissions.service.ts &mdash; decide()" },
    { regla: "Token de recuperaci&oacute;n", valor: "30 minutos, un solo uso", ubicacion: "auth.service.ts &mdash; RECOVERY_DURATION_MS" },
    { regla: "Vigencia de sesi&oacute;n", valor: "8 horas desde el login", ubicacion: "auth.service.ts &mdash; SESSION_DURATION_MS" },
    { regla: "Hash de contraseñas", valor: "SHA-256 con sal aleatoria por cuenta", ubicacion: "utils/crypto.ts" },
  ];

  const estados = [
    { entidad: "Admisi&oacute;n", estados: ["Radicada", "En revisi&oacute;n", "Admitido", "Rechazado"], badge: ["status-neutral", "status-warn", "status-good", "status-bad"] },
    { entidad: "Matr&iacute;cula", estados: ["Matriculada", "Cancelada"], badge: ["status-good", "status-bad"] },
    { entidad: "Cambio de programa", estados: ["Solicitada", "En revisi&oacute;n", "Aprobada", "Rechazada"], badge: ["status-neutral", "status-warn", "status-good", "status-bad"] },
    { entidad: "Homologaci&oacute;n", estados: ["Pendiente", "Aprobada", "Rechazada"], badge: ["status-warn", "status-good", "status-bad"] },
    { entidad: "Token de recuperaci&oacute;n", estados: ["Vigente", "Usado / Expirado"], badge: ["status-good", "status-neutral"] },
  ];

  return `<div class="tab-panel">
    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">Reglas</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Reglas de negocio</h2>
        <p class="section-lead">Las reglas implementadas en el c&oacute;digo y su ubicaci&oacute;n exacta. Sirven como base auditable del proceso.</p>
      </div>
    </div>
    <div class="table-scroll" style="margin-bottom:48px;">
      <table class="data-table">
        <thead><tr><th>Regla</th><th>Valor / l&oacute;gica</th><th>Ubicaci&oacute;n</th></tr></thead>
        <tbody>
          ${reglas.map((r) => `<tr><td><strong>${r.regla}</strong></td><td>${r.valor}</td><td><code style="font-size:12.5px;color:var(--navy-800);">${r.ubicacion}</code></td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section-intro" style="margin-bottom:24px;">
      <div>
        <span class="eyebrow">Modelo</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Estados por entidad</h2>
        <p class="section-lead">Cat&aacute;logo de estados v&aacute;lidos para cada tr&aacute;mite, con su badge visual.</p>
      </div>
    </div>
    ${estados.map((e) => {
      const badges = e.estados.map((s, i) => `<span class="status-badge ${e.badge[i]}">${s}</span>`).join(" ");
      return `<div style="margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px 18px;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-md);">
        <strong style="min-width:220px;font-family:var(--font-display);color:var(--navy-900);">${e.entidad}</strong>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">${badges}</div>
      </div>`;
    }).join("")}

    <div class="section-intro" style="margin:48px 0 24px;">
      <div>
        <span class="eyebrow">Mejora</span>
        <h2 style="font-family:var(--font-display);font-size:34px;margin:12px 0 8px;color:var(--navy-900);">Oportunidades detectadas</h2>
        <p class="section-lead">Una evoluci&oacute;n priorizada del sistema y recomendaciones de cierre.</p>
      </div>
    </div>

    <div class="notification-item notification-warning" style="margin-bottom:32px;padding:22px 26px;">
      <span class="notification-icon" aria-hidden="true">&#9888;</span>
      <div>
        <strong style="display:block;margin-bottom:6px;font-size:16px;">Brecha: a&uacute;n no hay un m&iacute;nimo de estudiantes para abrir un programa</strong>
        <span style="color:var(--ink-soft);font-size:14.5px;line-height:1.65;">
          El c&oacute;digo no incluye ninguna regla de <strong>cupo m&iacute;nimo</strong> o <strong>punto de equilibrio</strong> para decidir si una carrera o cohorte se abre en un periodo. Cada <code>CourseOffering</code> nace con un cupo m&aacute;ximo de ${CAPACITY_PER_OFFERING}, pero no existe un umbral m&iacute;nimo de matriculados que dispare la apertura, el cierre o la fusi&oacute;n de un grupo.
        </span>
        <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line-soft);font-size:13.5px;color:var(--muted);">
          <strong style="color:var(--navy-900);display:block;margin-bottom:6px;">Cambios sugeridos al modelo de datos</strong>
          <ul style="margin:0;padding-left:20px;line-height:1.6;">
            <li>Agregar <code>minEnrollment</code> (n&uacute;mero) a <code>CourseOffering</code>, o un valor por defecto a nivel <code>Program</code>.</li>
            <li>Agregar <code>enrollmentDeadline</code> (fecha) a <code>Period</code> para medir d&iacute;as restantes hasta el cierre.</li>
            <li>Exponer en el panel de Staff un tablero de ofertas por debajo del m&iacute;nimo.</li>
            <li>Definir la pol&iacute;tica: cancelar, fusionar con otro grupo, o abrir con aprobaci&oacute;n excepcional.</li>
          </ul>
          <p style="margin:12px 0 0;">Valor provisional de arranque sugerido: <strong>40%&ndash;50% del cupo m&aacute;ximo</strong> (10&ndash;13 estudiantes sobre ${CAPACITY_PER_OFFERING}). La pesta&ntilde;a <em>Programas</em> usa <strong>${MIN_ENROLLMENT_TO_OPEN}</strong> como referencia.</p>
        </div>
      </div>
    </div>

    <div class="section-heading" style="margin-bottom:20px;">
      <span>+</span>
      <div>
        <h3 style="font-family:var(--font-display);font-size:22px;color:var(--navy-900);margin:0 0 4px;">Recomendaciones para mejorar la gesti&oacute;n</h3>
      </div>
    </div>
    ${recommendation("&#8505;", "Diagramar los procesos como mapas BPMN", "Convertir los flujos de esta secci&oacute;n en diagramas BPMN con carriles por rol para presentaciones internas y auditor&iacute;as.", "info")}
    ${recommendation("&#10003;", "Tratar las reglas como cat&aacute;logo auditable", "La tabla de reglas de negocio es la base del cat&aacute;logo auditable &uacute;til para pruebas de aceptaci&oacute;n y certificaciones.", "success")}
    ${recommendation("&#9888;", "Backbone para series de tiempo reales", "Hoy los datos viven en localStorage; un backend permitir&iacute;a hist&oacute;ricos y series de tiempo reales para los indicadores.", "warning")}
    ${recommendation("&#10003;", "Priorizar la brecha de apertura", "Es el &uacute;nico proceso mencionado por el negocio que a&uacute;n no tiene soporte en el sistema y afecta directamente la sostenibilidad financiera.", "success")}
    ${recommendation("&#8505;", "Publicar las metas despu&eacute;s de validarlas", "Las metas sugeridas son punto de partida. Antes de publicarlas como oficiales, val&iacute;dalas con el comit&eacute; acad&eacute;mico.", "info")}

    <p class="table-note" style="margin-top:24px;font-style:italic;">
      Antes de tomar decisiones operativas con estos indicadores, valida los valores de meta con el &aacute;rea acad&eacute;mica y el comit&eacute; financiero.
    </p>
  </div>`;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

// ============================================================
// VISTAS SIMPLIFICADAS: Aspirante y Estudiante
// Solo muestran informaci&oacute;n relevante para su rol.
// ============================================================

function renderSimpleProcessStep(num: number, title: string, subtitle: string, steps: string[]): string {
  const items = steps.map((s) => `<li style="margin-bottom:10px;line-height:1.55;">${s}</li>`).join("");
  return `<details class="pensum-semester-card" style="margin-bottom:18px;" open>
    <summary style="list-style:none;cursor:pointer;outline:none;">
      <header class="pensum-semester-header" style="cursor:pointer;">
        <div class="pensum-semester-number">
          <span class="pensum-semester-num">${String(num).padStart(2, "0")}</span>
          <span class="pensum-semester-label">${subtitle}</span>
        </div>
        <h3 style="font-family:var(--font-display);font-size:20px;color:var(--navy-900);margin:0;flex:1;padding-left:18px;">${title}</h3>
      </header>
    </summary>
    <div style="padding:24px 28px;">
      <ol style="margin:0;padding-left:22px;color:var(--ink);font-size:15px;">${items}</ol>
    </div>
  </details>`;
}

function renderRecoveryNotice(): string {
  return `<article class="notification-item notification-info" style="margin-top:24px;">
    <span class="notification-icon" aria-hidden="true">&#128273;</span>
    <div>
      <strong style="display:block;margin-bottom:4px;">&iquest;Olvidaste tu contraseña?</strong>
      <span style="color:var(--ink-soft);font-size:14.5px;line-height:1.6;">Desde <a href="#recovery" style="color:var(--navy-700);font-weight:600;">#recuperar</a> puedes solicitar un enlace v&aacute;lido por 30 minutos. Si no tienes cuenta a&uacute;n, <a href="#register" style="color:var(--navy-700);font-weight:600;">crea una aqu&iacute;</a>.</span>
    </div>
  </article>`;
}

function renderHelpCta(): string {
  return `<article class="notification-item notification-success" style="margin-top:24px;">
    <span class="notification-icon" aria-hidden="true">&#10003;</span>
    <div>
      <strong style="display:block;margin-bottom:4px;">Si te quedan dudas, revisa las preguntas frecuentes</strong>
      <span style="color:var(--ink-soft);font-size:14.5px;line-height:1.6;">En la secci&oacute;n <a href="#faq" style="color:var(--navy-700);font-weight:600;">Preguntas frecuentes</a> encontrar&aacute;s respuestas r&aacute;pidas sobre admisiones, matr&iacute;cula, pagos y vida universitaria.</span>
    </div>
  </article>`;
}

function renderGraduationRequirements(program: Program | undefined): string {
  if (!program) {
    return `<section style="margin-bottom:24px;">
      <div class="section-heading"><span>04</span><div><h2 style="font-family:var(--font-display);font-size:22px;color:var(--navy-900);margin:0 0 6px;">Requisitos para graduarte</h2><p class="section-lead" style="margin:0;">A&uacute;n no tienes un programa asignado. Estos son los requisitos generales para graduarte en cualquier carrera.</p></div></div>
      <ul style="margin:0;padding-left:22px;color:var(--ink);font-size:15.5px;line-height:1.7;">
        <li>Aprobar el 100% de los cr&eacute;ditos del pensum de tu programa.</li>
        <li>Completar la pr&aacute;ctica profesional cuando aplique.</li>
        <li>Sustentar y aprobar el trabajo de grado (cuando sea requisito del programa).</li>
        <li>Estar al d&iacute;a con los compromisos financieros y acad&eacute;micos.</li>
      </ul>
    </section>`;
  }

  const courses = getCoursesByProgram(program.id);
  const totalCredits = courses.reduce((acc, c) => acc + c.credits, 0);
  const totalHours = courses.reduce((acc, c) => acc + c.hours, 0);
  const semesters = courses.length === 0 ? 0 : Math.max(...courses.map((c) => c.semester));
  const creditsByType: Record<string, number> = { Obligatoria: 0, Electiva: 0, Práctica: 0, "Trabajo de grado": 0, Cátedra: 0 };
  const coursesByType: Record<string, number> = { Obligatoria: 0, Electiva: 0, Práctica: 0, "Trabajo de grado": 0, Cátedra: 0 };
  for (const c of courses) {
    creditsByType[c.type] = (creditsByType[c.type] ?? 0) + c.credits;
    coursesByType[c.type] = (coursesByType[c.type] ?? 0) + 1;
  }

  const requirements = [
    `Aprobar <strong>${totalCredits} cr&eacute;ditos</strong> del pensum (${totalHours} horas, ${semesters} semestres).`,
    creditsByType["Práctica"] > 0 ? `Completar la <strong>pr&aacute;ctica</strong> (${creditsByType["Práctica"]} cr&eacute;ditos, ${coursesByType["Práctica"]} materia${coursesByType["Práctica"] === 1 ? "" : "s"}).` : null,
    creditsByType["Trabajo de grado"] > 0 ? `Sustentar y aprobar el <strong>trabajo de grado</strong> (${creditsByType["Trabajo de grado"]} cr&eacute;ditos).` : null,
    `Cursar las <strong>materias electivas</strong> requeridas (${creditsByType["Electiva"]} cr&eacute;ditos).`,
    creditsByType["Cátedra"] > 0 ? `Aprobar la <strong>C&aacute;tedra Institucional UNAC</strong> (${creditsByType["Cátedra"]} cr&eacute;dito${coursesByType["Cátedra"] === 1 ? "" : "s"}).` : null,
    `Estar al d&iacute;a con los compromisos financieros y acad&eacute;micos.`,
  ].filter((r): r is string => r !== null);

  return `<section style="margin-bottom:24px;">
    <div class="section-heading"><span>04</span><div><h2 style="font-family:var(--font-display);font-size:22px;color:var(--navy-900);margin:0 0 6px;">Requisitos para graduarte de ${program.name}</h2><p class="section-lead" style="margin:0;">${program.description}</p></div></div>
    <div class="profile-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px;">
      <article><b>${totalCredits}</b><span>Cr&eacute;ditos totales</span></article>
      <article><b>${totalHours}</b><span>Horas</span></article>
      <article><b>${semesters}</b><span>Semestres</span></article>
    </div>
    <ul style="margin:0;padding-left:22px;color:var(--ink);font-size:15.5px;line-height:1.7;">
      ${requirements.map((r) => `<li>${r}</li>`).join("")}
    </ul>
    <p style="margin-top:14px;"><a href="#pensum/${program.id}" style="color:var(--navy-700);font-weight:600;">Ver el pensum completo de ${program.name} &rarr;</a></p>
  </section>`;
}

function renderAspiranteBody(): string {
  const requirements = [
    "Ser bachiller (t&iacute;tulo de educaci&oacute;n media) o estar cursando el &uacute;ltimo a&ntilde;o.",
    "Tener documento de identidad vigente.",
    "Haber presentado las pruebas Saber 11 (o equivalente).",
    "Contar con un correo electr&oacute;nico activo para registrar tu cuenta.",
    "Elegir el programa acad&eacute;mico al que deseas aplicar.",
  ];

  const inscripcionSteps = [
    "<strong>Registro:</strong> crea tu cuenta en <em>#register</em> eligiendo el programa acad&eacute;mico al que deseas aplicar.",
    "<strong>Radicaci&oacute;n:</strong> completa el formulario en <em>#enrollment</em> con tu nivel, ciudad, modalidad y una carta de motivaci&oacute;n.",
    "<strong>Validaci&oacute;n autom&aacute;tica:</strong> el sistema bloquea una nueva solicitud si ya tienes una activa.",
    "<strong>Estado Radicada:</strong> tu solicitud queda visible para el equipo de admisiones.",
    "<strong>En revisi&oacute;n:</strong> el equipo de admisiones marca tu solicitud cuando empieza a evaluarla.",
    "<strong>Decisi&oacute;n:</strong> recibes una respuesta de <code>Admitido</code> o <code>Rechazado</code> con una nota.",
    "<strong>Si eres Admitido:</strong> tu cuenta pasa autom&aacute;ticamente de Aspirante a Estudiante.",
    "<strong>Seguimiento:</strong> puedes consultar el estado de tu solicitud en cualquier momento desde <em>#enrollment</em>.",
    "<strong>Re-radicaci&oacute;n:</strong> si tu solicitud fue rechazada, puedes iniciar un nuevo proceso.",
  ];

  return `
    <section style="margin-bottom:32px;">
      <div class="section-heading"><span>01</span><div><h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">Requisitos para inscribirte</h2><p class="section-lead" style="margin:0;">Lo que necesitas tener listo antes de radicar tu solicitud.</p></div></div>
      <ul style="margin:0;padding-left:22px;color:var(--ink);font-size:15.5px;line-height:1.7;">
        ${requirements.map((r) => `<li>${r}</li>`).join("")}
      </ul>
      <p style="margin-top:14px;font-size:14px;color:var(--muted);">Para algunos programas tambi&eacute;n se requiere entrevista personal. Lo ver&aacute;s indicado al elegir tu carrera.</p>
    </section>

    <section style="margin-bottom:32px;">
      <div class="section-heading"><span>02</span><div><h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">Tu proceso de admisi&oacute;n</h2><p class="section-lead" style="margin:0;">Estos son los pasos que seguir&aacute; tu solicitud desde que la radicas hasta que recibes una respuesta.</p></div></div>
      ${renderSimpleProcessStep(1, "Inscripci&oacute;n y admisi&oacute;n", "Aspirante &rarr; Staff", inscripcionSteps)}
    </section>

    ${renderHelpCta()}
    ${renderRecoveryNotice()}
  `;
}

function renderEstudianteBody(account: Account): string {
  const apps = listByApplicant(account.id);
  const admitted = apps.find((a) => a.status === "Admitido");
  const program = admitted ? getProgram(admitted.programId) : undefined;

  const matriculaSteps = [
    "<strong>Verificaci&oacute;n de requisitos:</strong> el sistema exige admisi&oacute;n <code>Admitido</code> y un periodo acad&eacute;mico activo.",
    "<strong>Selecci&oacute;n de materias:</strong> ingresa a <em>#registration</em> y revisa el pensum filtrado por la oferta acad&eacute;mica del periodo.",
    "<strong>Validaci&oacute;n 1 - Duplicidad:</strong> no se permite matricular dos veces la misma materia.",
    `<strong>Validaci&oacute;n 2 - L&iacute;mite de cr&eacute;ditos:</strong> el sistema bloquea si superas los ${MAX_CREDITS_PER_PERIOD} cr&eacute;ditos permitidos.`,
    "<strong>Validaci&oacute;n 3 - Choque de horario:</strong> compara d&iacute;a y franja horaria contra tus materias activas.",
    "<strong>Validaci&oacute;n 4 - Cupo disponible:</strong> verifica que la oferta tenga cupos libres.",
    "<strong>Confirmaci&oacute;n:</strong> al pasar todas las validaciones, el registro queda en estado <code>Matriculada</code>.",
    "<strong>Cancelaci&oacute;n:</strong> en cualquier momento puedes cancelar una materia para liberar el cupo.",
  ];

  const cambioSteps = [
    "Solicita el cambio desde <em>#program-change</em> indicando el programa destino y un motivo (m&iacute;nimo 40 caracteres).",
    "El sistema bloquea una nueva solicitud si ya tienes una en tr&aacute;mite.",
    "El equipo de admisiones revisa tu caso y decide <code>Aprobada</code> o <code>Rechazada</code>.",
    "El hist&oacute;rico de solicitudes queda disponible para ti y para Staff.",
  ];

  const homologacionSteps = [
    "Declara la materia externa desde <em>#prerequisites</em>: c&oacute;digo, nombre, instituci&oacute;n, a&ntilde;o y nota (0.0&ndash;5.0).",
    "Tu declaraci&oacute;n queda en estado <code>Pendiente</code> hasta que Staff la revise.",
    "Staff aprueba o rechaza con una nota de respuesta.",
    "Consulta el hist&oacute;rico y estado de cada homologaci&oacute;n desde tu perfil.",
  ];

  const graduacionSteps = [
    "Revisa tu avance en <em>#history</em>: debes tener el 100% de los cr&eacute;ditos del pensum.",
    "Verifica los requisitos espec&iacute;ficos: pr&aacute;ctica profesional y trabajo de grado (cuando aplique).",
    "Declara las materias externas que quieras homologar (v&iacute;a <em>#prerequisites</em>).",
    "El equipo acad&eacute;mico valida el cumplimiento final de requisitos.",
    "Una vez verificado, se emite el acta de grado correspondiente.",
  ];

  return `
    <section style="margin-bottom:32px;">
      <div class="section-heading"><span>01</span><div><h2 style="font-family:var(--font-display);font-size:24px;color:var(--navy-900);margin:0 0 6px;">Tu vida acad&eacute;mica</h2><p class="section-lead" style="margin:0;">Estos son los procesos que vas a usar durante tu carrera.</p></div></div>
      ${renderSimpleProcessStep(1, "Matr&iacute;cula de materias", "Estudiante autoservicio", matriculaSteps)}
      ${renderSimpleProcessStep(2, "Cambio de programa", "Estudiante &rarr; Staff", cambioSteps)}
      ${renderSimpleProcessStep(3, "Homologaci&oacute;n de prerrequisitos externos", "Estudiante &rarr; Staff", homologacionSteps)}
      ${renderSimpleProcessStep(4, "Graduaci&oacute;n", "Estudiante &rarr; Staff acad&eacute;mico", graduacionSteps)}
    </section>

    ${renderGraduationRequirements(program)}

    ${renderHelpCta()}
    ${renderRecoveryNotice()}
  `;
}

function renderStaffBody(account: Account | undefined): void {
  let activeTab: TabId = "tab-resumen";

  const renderTabContent = (): string => {
    switch (activeTab) {
      case "tab-resumen":
        return renderResumen();
      case "tab-indicadores":
        return renderIndicadores();
      case "tab-programas":
        return renderProgramas();
      case "tab-procesos":
        return renderProcesos();
      case "tab-reglas":
        return renderReglasYMejora();
    }
  };

  const updateShell = (): void => {
    renderShell(
      `<section class="profile-card" style="padding:36px 40px 44px;">
        ${renderHero()}
        ${renderTabs(activeTab)}
        <div class="tab-panel" id="gestion-content">${renderTabContent()}</div>
      </section>`,
      "Indicadores de gesti&oacute;n",
      account,
    );

    document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = (btn.dataset.tab ?? "tab-resumen") as TabId;
        if (next === activeTab) return;
        activeTab = next;
        updateShell();
        const target = document.querySelector("#gestion-content");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  updateShell();
}

export function renderGestionBpmView(account?: Account): void {
  const role = account?.role;
  if (role === "Staff") {
    renderStaffBody(account);
  } else if (role === "Estudiante" && account) {
    const hero = renderHeroForEstudiante(undefined);
    const body = renderEstudianteBody(account);
    renderShell(
      `<section class="profile-card" style="padding:36px 40px 44px;">${hero}<div class="tab-panel">${body}</div></section>`,
      "Indicadores de gesti&oacute;n",
      account,
    );
  } else {
    const hero = renderHeroForAspirante();
    const body = renderAspiranteBody();
    renderShell(
      `<section class="profile-card" style="padding:36px 40px 44px;">${hero}<div class="tab-panel">${body}</div></section>`,
      "Indicadores de gesti&oacute;n",
      account,
    );
  }
}
