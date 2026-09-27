import type { Account, FaqItem } from "../types";
import { renderShell } from "../utils/dom";
import { faqCategories, listAllFaq, searchFaq } from "../services/content.service";

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;");
}

// Preguntas destacadas: se muestran SIEMPRE en una columna debajo del buscador
// y de las categorías, con su respuesta desplegable. Son un subset fijo del FAQ
// identificadas por el ID del seed (no por texto, para evitar mismatch de tildes).
const SUGGESTED_IDS: string[] = ["FAQ-1", "FAQ-2", "FAQ-4", "FAQ-3", "FAQ-6", "FAQ-7"];

const SEARCH_ICON_SVG = `<svg class="faq-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>`;

function formatResult(item: FaqItem): string {
  return `<details class="faq-item">
    <summary><span class="faq-category">${item.category}</span><span class="faq-question">${item.question}</span></summary>
    <div class="faq-answer">${item.answer}</div>
  </details>`;
}

// Fallback hardcodeado: si por alguna razón listAllFaq() no devuelve los
// ítems esperados, mostramos estas preguntas/respuestas directamente.
const FALLBACK_SUGGESTIONS: { category: string; question: string; answer: string }[] = [
  { category: "Admisiones", question: "¿Cuáles son los requisitos para admisión?", answer: "Necesitas ser bachiller, presentar tu documento de identidad, resultados de pruebas Saber 11 y completar el formulario de inscripción. Para algunos programas también se requiere una entrevista personal." },
  { category: "Admisiones", question: "¿Cuándo son las inscripciones?", answer: "Las inscripciones para cada semestre están abiertas durante los meses de mayo y noviembre. Las fechas exactas se publican en la página principal y se anuncian por correo electrónico." },
  { category: "Matrícula", question: "¿Cuántos créditos puedo matricular por semestre?", answer: "El máximo es de 18 créditos por periodo académico. Algunos programas con cohortes especiales pueden tener reglas distintas." },
  { category: "Admisiones", question: "¿Puedo cambiar de carrera una vez admitido?", answer: "Sí. Desde tu perfil puedes solicitar un cambio de carrera. El equipo de admisiones evaluará tu caso y la disponibilidad de cupos en la nueva carrera." },
  { category: "Pagos", question: "¿Cuáles son las formas de pago?", answer: "Aceptamos pagos en línea con tarjeta de crédito o débito, transferencia bancaria y financiación directa con la universidad. También tenemos becas y descuentos por rendimiento." },
  { category: "Pagos", question: "¿Hay becas disponibles?", answer: "Sí: becas por rendimiento académico, becas socioeconómicas y descuentos para hermanos y egresados. Consulta con la oficina financiera." },
];

function renderFallbackSuggestion(item: { category: string; question: string; answer: string }): string {
  return `<details class="faq-item">
    <summary><span class="faq-category">${item.category}</span><span class="faq-question">${item.question}</span></summary>
    <div class="faq-answer">${item.answer}</div>
  </details>`;
}

function renderSuggestions(allFaq: FaqItem[]): string {
  const suggested = SUGGESTED_IDS
    .map((id) => allFaq.find((f) => f.id === id))
    .filter((f): f is FaqItem => Boolean(f));

  const itemsHtml = suggested.length > 0
    ? suggested.map(formatResult).join("")
    : FALLBACK_SUGGESTIONS.map(renderFallbackSuggestion).join("");

  return `<section class="faq-suggestions" aria-label="Preguntas frecuentes sugeridas">
    <header class="faq-suggestions-head">
      <span class="eyebrow">Sugeridas</span>
      <h3>Las preguntas que m&aacute;s nos hacen</h3>
      <p>Toca cualquier pregunta para desplegar su respuesta.</p>
    </header>
    <div class="faq-suggestions-list">
      ${itemsHtml}
    </div>
  </section>`;
}

export function renderFaqView(account?: Account): void {
  const categories = faqCategories();
  const allFaq = listAllFaq();
  let activeCategory = "Todas";
  let query = "";

  const updateResults = (): void => {
    const items = searchFaq(query, activeCategory);
    const list = document.querySelector(".faq-results");
    if (!list) return;
    list.innerHTML = items.length === 0
      ? `<div class="empty-state">No encontramos resultados para tu b&uacute;squeda. Prueba con otras palabras o cambia la categor&iacute;a.</div>`
      : items.map(formatResult).join("");
  };

  const render = (): void => {
    const results = searchFaq(query, activeCategory);
    renderShell(
      `<section class="profile-card faq-card">
        <header class="enrollment-header" style="padding-bottom:24px;border-bottom:1px solid var(--line-soft);margin-bottom:28px;">
          <div>
            <span class="eyebrow">Preguntas frecuentes</span>
            <h1>&iquest;En qu&eacute; podemos ayudarte?</h1>
            <p>Encuentra respuestas r&aacute;pidas sobre admisiones, matr&iacute;cula, pagos, vida universitaria y temas acad&eacute;micos. Si no encuentras lo que buscas, cont&aacute;ctanos directamente.</p>
          </div>
        </header>
        <div class="faq-controls">
          <label class="faq-search">
            <input id="faq-q" type="search" placeholder="Buscar por palabra clave..." value="${escapeAttr(query)}">
            ${SEARCH_ICON_SVG}
          </label>
          <div class="faq-categories" role="tablist">
            ${categories
              .map(
                (c) => `<button class="faq-tab ${c === activeCategory ? "active" : ""}" data-cat="${c}" type="button">${c}</button>`,
              )
              .join("")}
          </div>
        </div>
        ${renderSuggestions(allFaq)}
        <div class="faq-all">
          <header class="faq-all-head">
            <h3>Explora todas las preguntas</h3>
            <p>${results.length === allFaq.length ? "Mostrando todas las preguntas disponibles." : `Filtrando ${results.length} de ${allFaq.length} preguntas.`}</p>
          </header>
          <div class="faq-results">
            ${results.length === 0 ? `<div class="empty-state">No encontramos resultados para tu b&uacute;squeda. Prueba con otras palabras o cambia la categor&iacute;a.</div>` : results.map(formatResult).join("")}
          </div>
        </div>
      </section>`,
      "Preguntas frecuentes",
      account,
    );

    const input = document.querySelector<HTMLInputElement>("#faq-q");
    input?.addEventListener("input", () => {
      query = input.value;
      updateResults();
      updateResultsHeader();
    });

    document.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat ?? "Todas";
        document.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((b) => b.classList.toggle("active", b === btn));
        updateResults();
        updateResultsHeader();
      });
    });
  };

  const updateResultsHeader = (): void => {
    const header = document.querySelector<HTMLElement>(".faq-all-head p");
    if (!header) return;
    const filtered = searchFaq(query, activeCategory);
    header.textContent =
      filtered.length === allFaq.length
        ? "Mostrando todas las preguntas disponibles."
        : `Filtrando ${filtered.length} de ${allFaq.length} preguntas.`;
  };

  render();
}
