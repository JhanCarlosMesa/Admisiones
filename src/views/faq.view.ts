import type { Account, FaqItem } from "../types";
import { renderShell } from "../utils/dom";
import { faqCategories, searchFaq } from "../services/content.service";

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;");
}

function formatResult(item: FaqItem): string {
  return `<details class="faq-item">
    <summary><span class="faq-category">${item.category}</span><span class="faq-question">${item.question}</span></summary>
    <div class="faq-answer">${item.answer}</div>
  </details>`;
}

export function renderFaqView(account?: Account): void {
  const categories = faqCategories();
  let activeCategory = "Todas";
  let query = "";

  const render = () => {
    const results = searchFaq(query, activeCategory);
    renderShell(
      `<section class="profile-card faq-card">
        <header class="enrollment-header" style="padding-bottom:24px;border-bottom:1px solid var(--line-soft);margin-bottom:32px;">
          <div>
            <span class="eyebrow">Preguntas frecuentes</span>
            <h1>¿En qué podemos ayudarte?</h1>
            <p>Encuentra respuestas rápidas sobre admisiones, matrícula, pagos, vida universitaria y temas académicos. Si no encuentras lo que buscas, cont&aacute;ctanos directamente.</p>
          </div>
        </header>
        <div class="faq-controls">
          <label class="faq-search">
            <span>&#128269;</span>
            <input id="faq-q" type="search" placeholder="Buscar por palabra clave..." value="${escapeAttr(query)}">
          </label>
          <div class="faq-categories" role="tablist">
            ${categories
              .map(
                (c) => `<button class="faq-tab ${c === activeCategory ? "active" : ""}" data-cat="${c}" type="button">${c}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="faq-results">
          ${results.length === 0 ? `<div class="empty-state">No encontramos resultados para tu b&uacute;squeda. Prueba con otras palabras o cambia la categor&iacute;a.</div>` : results.map(formatResult).join("")}
        </div>
      </section>`,
      "Preguntas frecuentes",
      account,
    );

    const input = document.querySelector<HTMLInputElement>("#faq-q");
    input?.addEventListener("input", () => {
      query = input.value;
      const items = searchFaq(query, activeCategory);
      const list = document.querySelector(".faq-results");
      if (list) list.innerHTML = items.length === 0
        ? `<div class="empty-state">No encontramos resultados para tu b&uacute;squeda. Prueba con otras palabras o cambia la categor&iacute;a.</div>`
        : items.map(formatResult).join("");
    });

    document.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat ?? "Todas";
        document.querySelectorAll<HTMLButtonElement>("[data-cat]").forEach((b) => b.classList.toggle("active", b === btn));
        const items = searchFaq(query, activeCategory);
        const list = document.querySelector(".faq-results");
        if (list) list.innerHTML = items.length === 0
          ? `<div class="empty-state">No encontramos resultados para tu b&uacute;squeda. Prueba con otras palabras o cambia la categor&iacute;a.</div>`
          : items.map(formatResult).join("");
      });
    });
  };

  render();
}
