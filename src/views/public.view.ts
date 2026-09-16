import type { Account, Program } from "../types";
import { renderShell } from "../utils/dom";
import { currentAccount } from "../services/auth.service";
import { getCoursesByProgram, getPrograms } from "../services/catalog.service";

function actionForProgram(account: Account | undefined): string {
  if (!account) return '<span class="program-note">Inicia sesión para inscribirte</span>';
  if (account.role === "Aspirante") {
    return '<button class="enroll-button" type="button" data-go="enrollment">Inscribirme &rarr;</button>';
  }
  if (account.role === "Estudiante") {
    return '<span class="program-note">Ya eres estudiante UNAC</span>';
  }
  return '<span class="program-note">Vista de administración</span>';
}

function programCard(program: Program, action: string): string {
  const courses = getCoursesByProgram(program.id);
  const totalCredits = courses.reduce((total, course) => total + course.credits, 0);
  const semesters = [...new Set(courses.map((course) => course.semester))].sort((a, b) => a - b);
  const curriculum = semesters
    .map((semester) => {
      const semesterCourses = courses.filter((course) => course.semester === semester);
      return `<div class="semester-block"><div class="semester-heading"><strong>Semestre ${semester}</strong><span>${semesterCourses.reduce((total, course) => total + course.credits, 0)} créditos</span></div><ul>${semesterCourses.map((course) => `<li><span>${course.name}</span><small>${course.credits} cr.</small></li>`).join("")}</ul></div>`;
    })
    .join("");
  return `<article class="program-card ${program.colorClass}" data-level="${program.level}"><span class="program-tag">${program.level}</span><h3>${program.name}</h3><p>${program.description}</p><div class="program-meta"><span>${program.duration}</span><span>${program.modality}</span></div><button class="curriculum-toggle" type="button" aria-expanded="false" data-curriculum="${program.id}">Ver pensum <span>+</span></button><div class="curriculum-panel" id="curriculum-${program.id}" hidden><div class="curriculum-header"><div><span class="curriculum-eyebrow">Ruta académica</span><strong>Pensum de ${program.name}</strong></div><span class="curriculum-close-hint">Vista por semestres</span></div><div class="curriculum-stats"><div><strong>${courses.length}</strong><span>materias</span></div><div><strong>${totalCredits}</strong><span>créditos</span></div><div><strong>${semesters.length}</strong><span>semestres</span></div></div><div class="semester-list">${curriculum}</div></div>${action}</article>`;
}

export function renderPublicView(): void {
  const account = currentAccount();
  const programs = getPrograms();
  const action = actionForProgram(account);
  const heroActions = account
    ? '<a class="primary-button hero-button" href="#home">Ir a mi portal &rarr;</a>'
    : '<a class="primary-button hero-button" href="#login">Iniciar sesión &rarr;</a><a class="outline-button" href="#register">Crear cuenta</a>';

  renderShell(
    `<div class="public-page"><section class="public-hero"><div class="hero-copy"><span class="hero-kicker"><span class="kicker-dot"></span>Admisiones abiertas · 2026</span><h1>Estudia con propósito. <em>Construye tu futuro.</em></h1><p>Da el primer paso hacia una formación que combina excelencia académica, servicio y una comunidad que te acompaña.</p><div class="hero-actions">${heroActions}</div><div class="hero-proof"><div><strong>+85 años</strong><span>formando líderes</span></div><div><strong>4 programas</strong><span>para elegir tu camino</span></div></div></div><div class="hero-visual"><div class="visual-ring"></div><div class="visual-campus"><span class="campus-sun"></span><span class="campus-roof"></span><span class="campus-tower"></span><span class="campus-window window-a"></span><span class="campus-window window-b"></span><span class="campus-window window-c"></span><span class="campus-door"></span></div><div class="visual-card"><span class="card-label">PRÓXIMA FECHA</span><strong>15 JUN</strong><span>Inicio de clases</span></div></div></section><section class="trust-row"><div><span class="trust-mark">01</span><div><strong>Formación integral</strong><span>Conocimiento que transforma</span></div></div><div><span class="trust-mark">02</span><div><strong>Comunidad UNAC</strong><span>Una universidad que te recibe</span></div></div><div><span class="trust-mark">03</span><div><strong>Acompañamiento real</strong><span>Te guiamos en cada etapa</span></div></div></section><section class="programs-section"><div class="section-intro"><div><span class="eyebrow">Explora tu camino</span><h2>Encuentra el programa para ti</h2><p class="section-lead">Elige una carrera y comienza a escribir tu próxima historia.</p></div><span class="program-count">${programs.length} programas disponibles</span></div><div class="study-tools"><label class="study-search"><span>&#128269;</span><input id="program-search" type="search" placeholder="Busca por nombre de programa..." aria-label="Buscar programas"></label><div class="study-filters"><button class="filter-active" data-filter="all">Todos</button><button data-filter="Pregrado">Pregrado</button><button data-filter="Posgrado">Posgrado</button></div></div><div class="program-grid">${programs.map((program) => programCard(program, action)).join("")}</div></section><section class="apply-banner"><div><span class="eyebrow">Tu historia comienza hoy</span><h2>¿Listo para dar el siguiente paso?</h2><p>Regístrate en minutos y recibe orientación para iniciar tu proceso de admisión.</p></div><a class="apply-banner-link" href="#register">Crear mi cuenta <span>&rarr;</span></a></section></div>`,
    "Inicio",
    account,
  );

  const search = document.querySelector<HTMLInputElement>("#program-search");
  const cards = [...document.querySelectorAll<HTMLElement>(".program-card")];
  const filters = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  const apply = (filter: string, query: string) =>
    cards.forEach((card) => {
      const matchesFilter = filter === "all" || card.dataset.level === filter;
      const matchesQuery = card.textContent?.toLowerCase().includes(query.toLowerCase()) ?? false;
      card.hidden = !matchesFilter || !matchesQuery;
    });
  search?.addEventListener("input", () =>
    apply(
      document.querySelector<HTMLButtonElement>(".filter-active")?.dataset.filter ?? "all",
      search.value,
    ),
  );
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      filters.forEach((item) => item.classList.remove("filter-active"));
      button.classList.add("filter-active");
      apply(button.dataset.filter ?? "all", search?.value ?? "");
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-go='enrollment']").forEach((button) =>
    button.addEventListener("click", () => {
      location.hash = "enrollment";
    }),
  );

  document.querySelectorAll<HTMLButtonElement>("[data-curriculum]").forEach((button) =>
    button.addEventListener("click", () => {
      const programId = button.dataset.curriculum ?? "";
      const panel = document.querySelector<HTMLElement>(`#curriculum-${programId}`);
      if (!panel) return;
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      button.setAttribute("aria-expanded", String(!isOpen));
      button.classList.toggle("is-open", !isOpen);
      button.querySelector("span")!.textContent = isOpen ? "+" : "−";
    }),
  );
}
