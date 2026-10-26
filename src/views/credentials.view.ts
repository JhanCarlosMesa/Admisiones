import type { Account } from "../types";
import { renderShell } from "../utils/dom";
import { credentialLabel, listCredentialsFor } from "../services/credentials.service";
import { listAuditFor } from "../services/audit.service";

/** URL pública de verificación de una credencial. */
function verificationUrl(code: string): string {
  return `${location.origin}/#verify?code=${encodeURIComponent(code)}`;
}

/**
 * Código QR como imagen. Se usa un servicio externo porque generar un QR sin
 * librería son unas 200 líneas de código delicate. El código alfanumérico
 * siempre se muestra en texto grande, así que el documento sigue siendo
 * verificable aunque la imagen no cargue.
 */
function qrUrl(code: string): string {
  const target = encodeURIComponent(verificationUrl(code));
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${target}`;
}

function statusBadge(status: string): string {
  if (status === "Anclado") return "status-badge status-good";
  if (status === "Revocado") return "status-badge status-bad";
  if (status === "Fallido") return "status-badge status-bad";
  return "status-badge status-warn";
}

export function renderCredentialsView(account: Account): void {
  const credenciales = listCredentialsFor(account.id);

  const cards = credenciales
    .map((credential) => {
      const url = verificationUrl(credential.code);
      const auditoria = listAuditFor(credential.id);
      const pasos = auditoria
        .map(
          (item) =>
            `<li><strong>${item.action}</strong> · ${item.detail} <small>(${new Date(item.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })})</small></li>`,
        )
        .join("");

      return `<article class="credential-card">
        <div class="credential-qr">
          <img src="${qrUrl(credential.code)}" alt="Código QR de verificación" width="120" height="120" loading="lazy" />
          <span class="credential-code">${credential.code}</span>
        </div>
        <div class="credential-body">
          <div class="credential-head">
            <span class="pensum-subject-code">${credential.reference}</span>
            <span class="${statusBadge(credential.status)}">${credential.status}</span>
          </div>
          <h3 class="pensum-subject-name">${credentialLabel(credential.type)}</h3>
          <p class="pensum-subject-description">Emitido el ${new Date(credential.createdAt).toLocaleDateString("es-CO", { dateStyle: "long" })} por ${credential.issuedBy ?? "la UNAC"}.</p>
          <div class="pensum-subject-meta enrollment-meta">
            <span class="pensum-subject-meta-item"><b>${credential.payloadHash.slice(0, 12)}…</b><small>hash del documento</small></span>
            ${credential.anchoredAt ? `<span class="pensum-subject-meta-item"><b>${new Date(credential.anchoredAt).toLocaleDateString("es-CO")}</b><small>anclada</small></span>` : ""}
          </div>
          <p class="credential-hash"><small>Hash completo</small><code>${credential.payloadHash}</code></p>
          <div class="credential-actions">
            <a class="secondary-button" href="${url}">Verificar en p&uacute;blico &rarr;</a>
            <button class="outline-button-dark" data-copy="${url}" type="button">Copiar enlace</button>
          </div>
          ${pasos ? `<details class="admin-details"><summary>Bit&aacute;cora de la emisi&oacute;n</summary><ul class="credential-audit">${pasos}</ul></details>` : ""}
        </div>
      </article>`;
    })
    .join("");

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Credenciales</span>
          <h1>Mis credenciales</h1>
          <p>Cada documento emitido lleva un c&oacute;digo de verificaci&oacute;n. Con ese c&oacute;digo, cualquier persona puede comprobar que fue emitido por la UNAC y que no ha sido alterado, sin necesidad de cuenta.</p>
        </div>
      </div>
      ${
        credenciales.length
          ? `<div class="credential-list">${cards}</div>`
          : `<div class="pensum-semester-card"><div class="pensum-semester-header" style="justify-content:center;padding:32px;text-align:center;"><div><span class="pensum-semester-label">A&uacute;n no tienes credenciales emitidas. Cuando el equipo de admisiones emita un acta, un certificado de notas o una constancia, aparecer&aacute;n aqu&iacute;.</span></div></div></div>`
      }
    </section>`,
    "Mis credenciales",
    account,
  );

  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "Enlace copiado";
      } catch {
        button.textContent = value;
      }
    });
  });
}
