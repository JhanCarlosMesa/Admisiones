import { currentAccount } from "./services/auth.service";
import { renderPublicView } from "./views/public.view";
import { renderLoginView } from "./views/login.view";
import { renderRegisterView } from "./views/register.view";
import { renderRecoveryView } from "./views/recovery.view";
import { renderResetView } from "./views/reset.view";
import { renderHomeView } from "./views/home.view";
import { renderProfileView } from "./views/profile.view";
import { renderApplicationView } from "./views/application.view";
import { renderAdminView } from "./views/admin.view";
import { renderRegistrationView } from "./views/course-registration.view";
import { renderHistoryView } from "./views/history.view";
import { renderNotFoundView } from "./views/not-found.view";

function parseHash(): { path: string; query: URLSearchParams } {
  const raw = location.hash.replace(/^#/, "");
  const [path, query] = raw.split("?");
  return { path: path || "public", query: new URLSearchParams(query ?? "") };
}

export function route(): void {
  const { path, query } = parseHash();
  const account = currentAccount();

  if (path === "register") return renderRegisterView();
  if (path === "login") return renderLoginView();
  if (path === "recovery") return renderRecoveryView();
  if (path === "reset") return renderResetView(query.get("token") ?? "");
  if (path === "public") return renderPublicView();

  if (!account) {
    location.hash = "login";
    return;
  }

  if (path === "home") return renderHomeView(account);
  if (path === "profile") return renderProfileView(account);

  if (path === "enrollment") {
    if (account.role !== "Aspirante") {
      location.hash = "home";
      return;
    }
    return renderApplicationView(account);
  }

  if (path === "admin") {
    if (account.role !== "Staff") {
      location.hash = "home";
      return;
    }
    return renderAdminView(account);
  }

  if (path === "registration") {
    if (account.role !== "Estudiante") {
      location.hash = "home";
      return;
    }
    return renderRegistrationView(account);
  }

  if (path === "history") {
    if (account.role !== "Estudiante") {
      location.hash = "home";
      return;
    }
    return renderHistoryView(account);
  }

  return renderNotFoundView(account);
}

export function initRouter(): void {
  window.addEventListener("hashchange", route);
  route();
}
