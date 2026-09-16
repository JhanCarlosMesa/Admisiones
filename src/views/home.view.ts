import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { logout } from "../services/auth.service";
import { hasActiveApplication, listByApplicant } from "../services/admissions.service";
import { getProgram } from "../services/catalog.service";
import { listAll as listAllApplications } from "../services/admissions.service";

function aspiranteActions(account: Account): string {
  const applications = listByApplicant(account.id);
  const active = hasActiveApplication(account.id);
  const latest = applications[0];
  const statusLine = latest
    ? `<p>Tu última solicitud (${latest.id}) está en estado <strong>${latest.status}</strong>.</p>`
    : `<p>Aún no has radicado ninguna solicitud de admisión.</p>`;
  return `<article><span class="action-icon">01</span><div><h2>${active ? "Ver mi solicitud" : "Iniciar inscripción"}</h2>${statusLine}<button class="primary-button" id="go-enrollment">${active ? "Ver estado" : "Comenzar"} &rarr;</button></div></article>`;
}

function estudianteActions(): string {
  return `<article><span class="action-icon">01</span><div><h2>Matricular materias</h2><p>Selecciona tus materias para el periodo académico activo.</p><button class="primary-button" id="go-registration">Ir a matrícula &rarr;</button></div></article><article><span class="action-icon">02</span><div><h2>Historial académico</h2><p>Consulta las materias que has cursado por periodo.</p><button class="secondary-button" id="go-history" type="button">Ver historial</button></div></article>`;
}

function staffActions(): string {
  const pending = listAllApplications().filter(
    (item) => item.status === "Radicada" || item.status === "En revisión",
  ).length;
  return `<article><span class="action-icon">01</span><div><h2>Panel de admisiones</h2><p>${pending} solicitud(es) esperando revisión.</p><button class="primary-button" id="go-admin">Revisar solicitudes &rarr;</button></div></article>`;
}

export function renderHomeView(account: Account): void {
  const application = listByApplicant(account.id)[0];
  const program = application ? getProgram(application.programId) : undefined;
  const contextLine =
    account.role === "Estudiante" && program
      ? `<p>Programa: <strong>${program.name}</strong></p>`
      : "";

  let actions = "";
  if (account.role === "Aspirante") actions = aspiranteActions(account);
  else if (account.role === "Estudiante") actions = estudianteActions();
  else actions = staffActions();

  renderShell(
    `<section class="welcome-card"><span class="eyebrow">Portal ${account.role.toLowerCase()}</span><h1>Hola, ${account.firstName} &#128075;</h1><p>Bienvenido a tu portal de la UNAC.</p>${contextLine}<div class="home-actions">${actions}</div><div class="portal-actions"><a class="profile-link" href="#profile"><span class="profile-icon">&#128100;</span><span><strong>Mi perfil</strong><small>Consulta tus datos personales</small></span><span>&rarr;</span></a><button id="logout" class="logout-button" type="button">Cerrar sesión</button></div></section>`,
    "Inicio",
    account,
  );

  document.querySelector<HTMLButtonElement>("#go-enrollment")?.addEventListener("click", () => {
    location.hash = "enrollment";
  });
  document.querySelector<HTMLButtonElement>("#go-registration")?.addEventListener("click", () => {
    location.hash = "registration";
  });
  document.querySelector<HTMLButtonElement>("#go-history")?.addEventListener("click", () => {
    location.hash = "history";
  });
  document.querySelector<HTMLButtonElement>("#go-admin")?.addEventListener("click", () => {
    location.hash = "admin";
  });
  document.querySelector<HTMLButtonElement>("#logout")!.addEventListener("click", () => {
    logout();
    location.hash = "login";
  });
}
