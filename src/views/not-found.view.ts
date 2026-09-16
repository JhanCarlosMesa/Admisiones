import type { Account } from "../types";
import { renderShell } from "../utils/dom";

export function renderNotFoundView(account?: Account): void {
  renderShell(
    `<section class="welcome-card"><span class="eyebrow">Error 404</span><h1>No encontramos esta página</h1><p>Verifica el enlace o vuelve al inicio.</p><a class="primary-button hero-button" href="#public">Volver al inicio &rarr;</a></section>`,
    "Página no encontrada",
    account,
  );
}
