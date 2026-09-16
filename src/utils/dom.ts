import type { Account } from "../types";

function buildNav(account?: Account): string {
  if (!account) {
    return '<div class="topbar-context"><span class="secure-dot"></span>Portal seguro de admisiones</div>';
  }
  const links: string[] = ['<a href="#home">Inicio</a>'];
  if (account.role === "Aspirante") links.push('<a href="#enrollment">Mi solicitud</a>');
  if (account.role === "Estudiante") {
    links.push('<a href="#registration">Matr&iacute;cula</a>');
    links.push('<a href="#history">Historial</a>');
  }
  if (account.role === "Staff") links.push('<a href="#admin">Panel de admisiones</a>');
  links.push('<a href="#profile">Perfil</a>');
  return `<nav class="topbar-nav" aria-label="Navegaci\u00f3n del portal">${links.join("")}</nav>`;
}

export function renderShell(content: string, title: string, account?: Account): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  app.innerHTML = `<header class="topbar"><a class="brand" href="#public" aria-label="UNAC, inicio"><span class="brand-mark" aria-hidden="true">A</span><span>UNAC</span></a>${buildNav(account)}</header><main class="page-shell"><nav class="breadcrumbs"><a href="#public">Inicio</a><span>/</span><strong>${title}</strong></nav>${content}</main><footer><span>&copy; 2026 UNAC</span><span>Admisiones <b>&bull;</b> Privacidad</span></footer>`;
}

export function setFieldError(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  text: string,
): void {
  field.classList.toggle("invalid", Boolean(text));
  const target = field.parentElement?.querySelector<HTMLElement>(".field-error");
  if (target) target.textContent = text;
}

export function setFormMessage(text: string, type: "error" | "success"): void {
  const target = document.querySelector<HTMLElement>("#form-message");
  if (target) {
    target.className = `form-message ${type}`;
    target.textContent = text;
  }
}

export function badgeClassForStatus(status: string): string {
  switch (status) {
    case "Admitido":
    case "Matriculada":
      return "status-badge status-good";
    case "Rechazado":
    case "Cancelada":
      return "status-badge status-bad";
    case "En revisión":
      return "status-badge status-warn";
    default:
      return "status-badge status-neutral";
  }
}
