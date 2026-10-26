import type { Account, CredentialType } from "../types";
import { renderShell, setFormMessage } from "../utils/dom";
import { listAll as listAllApplications } from "../services/admissions.service";
import { getAccounts } from "../services/auth.service";
import { getActivePeriod, getProgram } from "../services/catalog.service";
import { createCredential, credentialLabel } from "../services/credentials.service";
import { issueCredential } from "../services/anchoring.service";
import {
  buildEnrollmentPayload,
  buildGraduationPayload,
  buildTranscriptPayload,
} from "../services/payloads.service";
import { listAllAudit } from "../services/audit.service";

const TIPOS: CredentialType[] = ["ACTA_GRADO", "CERTIFICADO_NOTAS", "CONSTANCIA_MATRICULA"];

function estudiantesAdmitidos(): Array<{ id: string; nombre: string; email: string; programa: string }> {
  const accounts = getAccounts();
  const admisiones = listAllApplications().filter((item) => item.status === "Admitido");
  return admisiones
    .map((admision) => {
      const account = accounts.find((item) => item.id === admision.applicantId);
      if (!account) return undefined;
      return {
        id: account.id,
        nombre: `${account.firstName} ${account.lastName}`,
        email: account.email,
        programa: getProgram(admision.programId)?.name ?? admision.programId,
      };
    })
    .filter((item): item is { id: string; nombre: string; email: string; programa: string } => Boolean(item))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function renderIssuanceView(account: Account): void {
  const estudiantes = estudiantesAdmitidos();
  const period = getActivePeriod();
  const auditoria = listAllAudit().slice(0, 8);

  const rows = auditoria
    .map(
      (item) => `<tr>
        <td>${item.action}</td>
        <td>${item.actor}</td>
        <td>${item.detail}</td>
        <td>${new Date(item.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</td>
      </tr>`,
    )
    .join("");

  renderShell(
    `<section class="enrollment-card">
      <div class="enrollment-header">
        <div>
          <span class="eyebrow">Staff acad&eacute;mico</span>
          <h1>Emisi&oacute;n de credenciales</h1>
          <p>Genera el documento, se calcula su hash y se ancla con la firma institucional. A la cadena solo llega el hash: los datos personales se quedan fuera.</p>
        </div>
      </div>
      <div id="form-message" class="form-message"></div>

      <section class="profile-section">
        <header class="profile-section-header">
          <span class="eyebrow">Nueva credencial</span>
          <h2>Emitir documento verificable</h2>
        </header>
        <form id="issuance-form" novalidate>
          <div class="form-grid">
            <label>Estudiante
              <select name="studentId" required>
                <option value="">Selecciona un estudiante…</option>
                ${estudiantes
                  .map(
                    (item) =>
                      `<option value="${item.id}">${item.nombre} — ${item.programa}</option>`,
                  )
                  .join("")}
              </select>
            </label>
            <label>Tipo de documento
              <select name="type" required>
                ${TIPOS.map((tipo) => `<option value="${tipo}">${credentialLabel(tipo)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="form-footer">
            <p>Periodo de referencia: <strong>${period?.name ?? "—"}</strong>. El acta usa el avance real del estudiante; el certificado, sus notas del periodo.</p>
            <button type="submit">Emitir y anclar &rarr;</button>
          </div>
        </form>
      </section>

      <section class="profile-section">
        <header class="profile-section-header">
          <span class="eyebrow">Trazabilidad</span>
          <h2>&Uacute;ltimas acciones de anclaje</h2>
        </header>
        <div class="table-scroll"><table class="data-table"><thead><tr><th>Acci&oacute;n</th><th>Actor</th><th>Detalle</th><th>Fecha</th></tr></thead><tbody>${
          rows || '<tr><td colspan="4">A&uacute;n no hay acciones registradas.</td></tr>'
        }</tbody></table></div>
      </section>
    </section>`,
    "Emisión de credenciales",
    account,
  );

  const form = document.querySelector<HTMLFormElement>("#issuance-form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const studentId = String(data.get("studentId") ?? "");
    const type = String(data.get("type") ?? "") as CredentialType;
    if (!studentId || !type) {
      setFormMessage("Selecciona un estudiante y un tipo de documento.", "error");
      return;
    }
    const admision = listAllApplications().find(
      (item) => item.applicantId === studentId && item.status === "Admitido",
    );
    if (!admision) {
      setFormMessage("El estudiante no tiene una admisión aprobada.", "error");
      return;
    }
    const periodo = period?.id ?? "";

    const payload =
      type === "ACTA_GRADO"
        ? await buildGraduationPayload(studentId, admision.programId)
        : type === "CERTIFICADO_NOTAS"
          ? buildTranscriptPayload(studentId, periodo)
          : buildEnrollmentPayload(studentId, admision.programId, periodo);

    const credential = await createCredential({
      type,
      studentId,
      programId: admision.programId,
      periodId: periodo,
      payload,
      issuedBy: account.email,
    });

    const result = await issueCredential(credential);
    if (!result.ok) {
      setFormMessage(result.error ?? "No se pudo anclar la credencial.", "error");
      return;
    }

    setFormMessage(`Credencial ${credential.reference} emitida y anclada.`, "success");
    renderIssuanceView(account);
  });
}
