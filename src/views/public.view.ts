import type { Account, Program } from "../types";
import { renderShell } from "../utils/dom";
import { currentAccount } from "../services/auth.service";
import { getCoursesByProgram, getPrograms } from "../services/catalog.service";
import { listUpcomingEvents } from "../services/events.service";
import { listAllTestimonials } from "../services/content.service";
import { getProgram } from "../services/catalog.service";

function actionForProgram(account: Account | undefined): string {
  if (!account) return '<span class="program-note">Inicia sesi&oacute;n para inscribirte</span>';
  if (account.role === "Aspirante") {
    return '<button class="enroll-button" type="button" data-go="enrollment">Inscribirme &rarr;</button>';
  }
  if (account.role === "Estudiante") {
    return '<span class="program-note">Ya eres estudiante UNAC</span>';
  }
  return '<span class="program-note">Vista de administraci&oacute;n</span>';
}

function programCard(program: Program, action: string): string {
  const courses = getCoursesByProgram(program.id);
  const totalCredits = courses.reduce((total, course) => total + course.credits, 0);
  const totalHours = courses.reduce((total, course) => total + course.hours, 0);
  const semesters = [...new Set(courses.map((course) => course.semester))].sort((a, b) => a - b);
  return `<article class="program-card ${program.colorClass}" data-level="${program.level}"><span class="program-tag">${program.level}</span><h3>${program.name}</h3><p>${program.description}</p><div class="program-meta"><span>${program.duration}</span><span>${program.modality}</span><span><b>${courses.length}</b> materias</span></div><div class="program-card-footer"><a class="curriculum-toggle" href="#pensum/${program.id}">Ver pensum completo <span>&rarr;</span></a><div class="program-card-stats"><span><b>${totalCredits}</b><small>cr&eacute;ditos</small></span><span><b>${totalHours}</b><small>h/sem</small></span><span><b>${semesters.length}</b><small>semestres</small></span></div></div>${action}</article>`;
}

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

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function eventIcon(type: string): string {
  if (type === "Open Day") return "&#127881;";
  if (type === "Feria") return "&#127978;";
  if (type === "Tour") return "&#128506;";
  if (type === "Webinar") return "&#128187;";
  return "&#128218;";
}

function eventsSection(): string {
  const events = listUpcomingEvents(4);
  if (events.length === 0) return "";
  return `<section class="events-section">
    <div class="section-intro">
      <div>
        <span class="eyebrow">Pr&oacute;ximos eventos</span>
        <h2>Open days, ferias y charlas</h2>
        <p class="section-lead">Conoce de cerca nuestros programas en actividades presenciales y online. La entrada es libre y abierta a todo p&uacute;blico.</p>
      </div>
      <span class="program-count">${events.length} pr&oacute;ximos</span>
    </div>
    <div class="events-grid">
      ${events
        .map(
          (e) => `
        <article class="event-card">
          <div class="event-head">
            <span class="event-icon" aria-hidden="true">${eventIcon(e.type)}</span>
            <div>
              <span class="event-type">${e.type}</span>
              <h3>${e.title}</h3>
            </div>
          </div>
          <p>${e.description}</p>
          <div class="event-meta">
            <span><b>${new Date(e.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</b><small>${e.location}</small></span>
            <span><b>${e.enrolled}/${e.capacity}</b><small>inscritos</small></span>
          </div>
          ${e.speaker ? `<p class="event-speaker">A cargo de: <strong>${e.speaker}</strong></p>` : ""}
          <button class="secondary-button event-enroll" data-event="${e.id}" type="button">Reservar mi cupo</button>
        </article>
      `,
        )
        .join("")}
    </div>
  </section>`;
}

function testimonialsSection(): string {
  const testimonials = listAllTestimonials();
  if (testimonials.length === 0) return "";
  return `<section class="testimonials-section">
    <div class="section-intro">
      <div>
        <span class="eyebrow">Voces UNAC</span>
        <h2>Lo que dicen nuestros egresados</h2>
        <p class="section-lead">Historias reales de quienes pasaron por la UNAC y hoy construyen su futuro profesional.</p>
      </div>
      <span class="program-count">${testimonials.length} testimonios</span>
    </div>
    <div class="testimonials-grid">
      ${testimonials
        .map((t) => {
          const program = getProgram(t.programId);
          return `<article class="testimonial-card">
            <blockquote>"${t.quote}"</blockquote>
            <div class="testimonial-author">
              <span class="testimonial-avatar" aria-hidden="true">${t.initials}</span>
              <div>
                <strong>${t.name}</strong>
                <span>${t.currentRole} &middot; ${t.company}</span>
                <small>${program?.name ?? ""} &middot; Egresada ${t.graduationYear}</small>
              </div>
            </div>
          </article>`;
        })
        .join("")}
    </div>
  </section>`;
}

function costCalculator(): string {
  const programs = getPrograms();
  return `<section class="cost-section">
    <div class="section-intro">
      <div>
        <span class="eyebrow">Financiaci&oacute;n</span>
        <h2>Calcula el costo de tu matr&iacute;cula</h2>
        <p class="section-lead">Ajusta los cr&eacute;ditos que planeas tomar y descubre cu&aacute;nto invertir&iacute;as este semestre. (Valores referenciales 2026.)</p>
      </div>
    </div>
    <div class="cost-card">
      <div class="cost-controls">
        <label>
          <span>Programa acad&eacute;mico</span>
          <select id="cost-program">
            ${programs
              .map((p) => `<option value="${p.id}">${p.name}</option>`)
              .join("")}
          </select>
        </label>
        <label>
          <span>Cr&eacute;ditos a matricular: <strong id="cost-credits-label">16</strong></span>
          <input id="cost-credits" type="range" min="3" max="18" value="16">
          <small>Entre 3 y 18 cr&eacute;ditos por periodo</small>
        </label>
        <label class="cost-check">
          <input id="cost-discount" type="checkbox">
          <span>Aplicar descuento por beca (20%)</span>
        </label>
      </div>
      <div class="cost-summary">
        <div>
          <span>Valor por cr&eacute;dito</span>
          <strong id="cost-per-credit">—</strong>
        </div>
        <div>
          <span>Subtotal</span>
          <strong id="cost-subtotal">—</strong>
        </div>
        <div class="cost-total">
          <span>Total a pagar</span>
          <strong id="cost-total">—</strong>
        </div>
        <a class="primary-button" href="#register">Iniciar admisi&oacute;n &rarr;</a>
      </div>
    </div>
  </section>`;
}

function bindCostCalculator(): void {
  const programSelect = document.querySelector<HTMLSelectElement>("#cost-program");
  const creditsInput = document.querySelector<HTMLInputElement>("#cost-credits");
  const creditsLabel = document.querySelector<HTMLElement>("#cost-credits-label");
  const discountInput = document.querySelector<HTMLInputElement>("#cost-discount");
  if (!programSelect || !creditsInput || !creditsLabel) return;
  const perCreditEl = document.querySelector<HTMLElement>("#cost-per-credit");
  const subtotalEl = document.querySelector<HTMLElement>("#cost-subtotal");
  const totalEl = document.querySelector<HTMLElement>("#cost-total");
  const update = () => {
    const id = programSelect.value;
    const credits = Number(creditsInput.value);
    const perCredit = COST_PER_CREDIT[id] ?? 250000;
    const subtotal = perCredit * credits;
    const total = discountInput?.checked ? subtotal * 0.8 : subtotal;
    creditsLabel.textContent = String(credits);
    if (perCreditEl) perCreditEl.textContent = formatCOP(perCredit);
    if (subtotalEl) subtotalEl.textContent = formatCOP(subtotal);
    if (totalEl) totalEl.textContent = formatCOP(total);
  };
  programSelect.addEventListener("change", update);
  creditsInput.addEventListener("input", update);
  discountInput?.addEventListener("change", update);
  update();
}

function bindEventEnrollment(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.event;
      if (!id) return;
      btn.textContent = "Inscrito ✓";
      btn.classList.add("event-enrolled");
      btn.disabled = true;
    });
  });
}

export function renderPublicView(): void {
  const account = currentAccount();
  const programs = getPrograms();
  const action = actionForProgram(account);
  const heroActions = account
    ? '<a class="primary-button hero-button" href="#home">Ir a mi portal &rarr;</a>'
    : '<a class="primary-button hero-button" href="#login">Iniciar sesi&oacute;n &rarr;</a><a class="outline-button" href="#register">Crear cuenta</a>';

  renderShell(
    `<div class="public-page"><section class="public-hero"><div class="hero-copy"><span class="hero-kicker"><span class="kicker-dot"></span>Admisiones abiertas · 2026</span><h1>Estudia con propósito. <em>Construye tu futuro.</em></h1><p>Da el primer paso hacia una formación que combina excelencia académica, servicio y una comunidad que te acompaña.</p><div class="hero-actions">${heroActions}<a class="outline-button" href="#faq">Preguntas frecuentes</a></div><div class="hero-proof"><div><strong>+85 años</strong><span>formando líderes</span></div><div><strong>${programs.length} programas</strong><span>para elegir tu camino</span></div></div></div><div class="hero-visual"><div class="visual-ring"></div><div class="visual-campus"><span class="campus-sun"></span><span class="campus-roof"></span><span class="campus-tower"></span><span class="campus-window window-a"></span><span class="campus-window window-b"></span><span class="campus-window window-c"></span><span class="campus-door"></span></div><div class="visual-card"><span class="card-label">PRÓXIMA FECHA</span><strong>15 JUN</strong><span>Inicio de clases</span></div></div></section><section class="trust-row"><div><span class="trust-mark">01</span><div><strong>Formación integral</strong><span>Conocimiento que transforma</span></div></div><div><span class="trust-mark">02</span><div><strong>Comunidad UNAC</strong><span>Una universidad que te recibe</span></div></div><div><span class="trust-mark">03</span><div><strong>Acompañamiento real</strong><span>Te guiamos en cada etapa</span></div></div></section><section class="programs-section"><div class="section-intro"><div><span class="eyebrow">Explora tu camino</span><h2>Encuentra el programa para ti</h2><p class="section-lead">Elige una carrera y comienza a escribir tu próxima historia. Haz clic en cualquier programa para ver el pensum completo con materias, créditos y descripción.</p></div><span class="program-count">${programs.length} programas disponibles</span></div><div class="study-tools"><label class="study-search"><svg class="study-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg><input id="program-search" type="search" placeholder="Busca por nombre de programa..." aria-label="Buscar programas"></label><div class="study-filters"><button class="filter-active" data-filter="all">Todos</button><button data-filter="Pregrado">Pregrado</button><button data-filter="Posgrado">Posgrado</button></div></div><div class="program-grid">${programs.map((program) => programCard(program, action)).join("")}</div></section>${eventsSection()}${testimonialsSection()}${costCalculator()}<section class="apply-banner"><div><span class="eyebrow">Tu historia comienza hoy</span><h2>¿Listo para dar el siguiente paso?</h2><p>Regístrate en minutos y recibe orientación para iniciar tu proceso de admisión.</p></div><a class="apply-banner-link" href="#register">Crear mi cuenta <span>&rarr;</span></a></section></div>`,
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

  bindCostCalculator();
  bindEventEnrollment();
}
