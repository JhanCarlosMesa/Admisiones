import { renderShell } from "../utils/dom";
import { getTransport, type VerificationReport } from "../services/anchoring.service";
import { credentialLabel } from "../services/credentials.service";

function statusClass(status: string): string {
  if (status === "VERIFICADO") return "verify-ok";
  if (status === "ALTERADO") return "verify-warn";
  return "verify-bad";
}

function statusIcon(status: string): string {
  if (status === "VERIFICADO") return "&#10003;";
  if (status === "ALTERADO") return "&#9888;";
  return "&#10005;";
}

function reportHtml(report: VerificationReport): string {
  const anchor = report.anchor;
  const credential = report.credential;
  return `<div class="verify-result ${statusClass(report.status)}">
    <div class="verify-result-head">
      <span class="verify-icon" aria-hidden="true">${statusIcon(report.status)}</span>
      <div>
        <strong>${report.status}</strong>
        <span>${report.detail}</span>
      </div>
    </div>
    ${
      anchor
        ? `<table class="verify-table">
            <tbody>
              <tr><th>Folio</th><td>${anchor.reference}</td></tr>
              <tr><th>Tipo</th><td>${credentialLabel(anchor.type)}</td></tr>
              <tr><th>Programa</th><td>${anchor.programId ?? "—"}</td></tr>
              <tr><th>Periodo</th><td>${anchor.periodId ?? "—"}</td></tr>
              <tr><th>Hash del documento</th><td><code>${anchor.payloadHash}</code></td></tr>
              ${anchor.signedAt ? `<tr><th>Sello de tiempo</th><td>${new Date(anchor.signedAt).toLocaleString("es-CO")}</td></tr>` : ""}
              ${anchor.signature ? `<tr><th>Firma institucional</th><td><code>${anchor.signature}</code></td></tr>` : ""}
            </tbody>
          </table>`
        : ""
    }
    ${
      credential && credential.status === "Revocado"
        ? `<p class="verify-note">Motivo de la revocaci&oacute;n: ${credential.error ?? "no registrado"}</p>`
        : ""
    }
  </div>`;
}

export async function renderVerifyView(code: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  const report = normalized
    ? await getTransport().verify(normalized)
    : {
        verified: false,
        status: "NO ENCONTRADO" as const,
        detail: "Escribe el código de verificación del documento para comprobar su autenticidad.",
      };

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Verificaci&oacute;n p&uacute;blica</span>
          <h1>Comprobar un documento UNAC</h1>
          <p>Este verificador es p&uacute;blico: no necesitas cuenta ni ning&uacute;n dato personal. Escribe el c&oacute;digo que aparece en el documento y te decimos si es aut&eacute;ntico.</p>
        </div>
      </div>
      <form id="verify-form" novalidate>
        <label>C&oacute;digo de verificaci&oacute;n
          <input name="code" type="text" value="${normalized}" placeholder="Ej: 7F3K2D" maxlength="12" autocomplete="off" />
        </label>
        <div class="form-footer">
          <button type="submit">Verificar &rarr;</button>
        </div>
      </form>
      ${reportHtml(report)}
    </section>`,
    "Verificar documento",
  );

  const form = document.querySelector<HTMLFormElement>("#verify-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const value = String(data.get("code") ?? "").trim();
    location.hash = value ? `verify?code=${encodeURIComponent(value)}` : "verify";
  });
}
