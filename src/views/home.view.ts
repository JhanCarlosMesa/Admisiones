import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { logout } from "../services/auth.service";
import { hasActiveApplication, listByApplicant } from "../services/admissions.service";
import { getProgram } from "../services/catalog.service";
import { listAll as listAllApplications } from "../services/admissions.service";
import { listActiveNotificationsFor } from "../services/notifications.service";
import { hasPendingProgramChange } from "../services/program-changes.service";

function notificationIcon(type: string): string {
  if (type === "warning") return "&#9888;";
  if (type === "success") return "&#10003;";
  if (type === "danger") return "&#9888;";
  return "&#8505;";
}

function notificationsBanner(account: Account): string {
  const list = listActiveNotificationsFor(account.role).slice(0, 2);
  if (list.length === 0) return "";
  return `<aside class="notifications-banner">
    ${list
      .map(
        (n) => `
        <div class="notification-item notification-${n.type}">
          <span class="notification-icon" aria-hidden="true">${notificationIcon(n.type)}</span>
          <div>
            <strong>${n.title}</strong>
            <span>${n.body}</span>
          </div>
        </div>`,
      )
      .join("")}
  </aside>`;
}

function pendientePill(label: string, href: string): string {
  return `<a class="home-pendiente" href="${href}"><span class="dot"></span>${label} &rarr;</a>`;
}

function homeActionsForRole(account: Account, _application: ReturnType<typeof listByApplicant>[number] | undefined): string {
  if (account.role === "Aspirante") {
    const active = hasActiveApplication(account.id);
    return `<article><span class="action-icon">01</span><div><h2>${active ? "Ver mi solicitud" : "Iniciar inscripci&oacute;n"}</h2><p>${active ? "Consulta el estado de tu proceso." : "Radic&aacute; tu solicitud de admisi&oacute;n en minutos."}</p><button class="primary-button" id="go-enrollment">${active ? "Ver estado" : "Comenzar"} &rarr;</button></div></article><article><span class="action-icon">02</span><div><h2>Explorar programas</h2><p>Conoce las 10 carreras disponibles y revisa el pensum.</p><a class="secondary-button" href="#public">Ver programas &rarr;</a></div></article>`;
  }
  if (account.role === "Estudiante") {
    const pendingChange = hasPendingProgramChange(account.id);
    return `<article><span class="action-icon">01</span><div><h2>Matricular materias</h2><p>Selecciona tus materias para el periodo acad&eacute;mico activo.</p><button class="primary-button" id="go-registration">Ir a matr&iacute;cula &rarr;</button></div></article><article><span class="action-icon">02</span><div><h2>Historial acad&eacute;mico</h2><p>Consulta las materias que has cursado por periodo.</p><button class="secondary-button" id="go-history" type="button">Ver historial</button></div></article><article><span class="action-icon">03</span><div><h2>Gestionar mi perfil</h2><p>Actualiza tus datos, declara prerrequisitos o solicita un cambio de carrera.</p><a class="secondary-button" href="#profile">Mi perfil &rarr;</a></div></article>` +
      (pendingChange ? pendientePill("Tienes una solicitud de cambio de carrera en revisión", "#program-change") : pendientePill("Solicitar cambio de carrera", "#program-change"));
  }
  // Staff
  const pendingAdmissions = listAllApplications().filter((item) => item.status === "Radicada" || item.status === "En revisión").length;
  return `<article><span class="action-icon">01</span><div><h2>Panel de admisiones</h2><p>${pendingAdmissions} solicitud(es) esperando revisi&oacute;n.</p><button class="primary-button" id="go-admin">Revisar solicitudes &rarr;</button></div></article><article><span class="action-icon">02</span><div><h2>Resumen general</h2><p>Vista r&aacute;pida del estado del sistema y solicitudes activas.</p><a class="secondary-button" href="#public">Ver portal p&uacute;blico &rarr;</a></div></article>`;
}

export function renderHomeView(account: Account): void {
  const application = listByApplicant(account.id)[0];
  const program = application ? getProgram(application.programId) : undefined;
  const contextLine =
    account.role === "Estudiante" && program
      ? `<p>Programa: <strong>${program.name}</strong> &middot; <a href="#pensum/${program.id}">Ver pensum &rarr;</a></p>`
      : account.role === "Aspirante" && application
        ? `<p>Solicitud activa: <strong>${application.status}</strong> &middot; <a href="#enrollment">Ver detalle &rarr;</a></p>`
        : "";

  const actions = homeActionsForRole(account, application);

  renderShell(
    `${notificationsBanner(account)}<section class="welcome-card"><span class="eyebrow">Portal ${account.role.toLowerCase()}</span><h1>Hola, ${account.firstName} &#128075;</h1><p>Bienvenido a tu portal de la UNAC.</p>${contextLine}<div class="home-actions">${actions}</div><div class="portal-actions"><a class="profile-link" href="#profile"><span class="profile-icon">&#128100;</span><span><strong>Mi perfil</strong><small>${account.role === "Estudiante" ? "Programa, progreso académico, cambios de carrera y más" : "Datos personales y de contacto"}</small></span><span>&rarr;</span></a><button id="logout" class="logout-button" type="button">Cerrar sesi&oacute;n</button></div></section>`,
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
