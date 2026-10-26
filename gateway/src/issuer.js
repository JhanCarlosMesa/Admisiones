/**
 * Emisor de documentos.
 *
 * Genera el documento imprimible de una credencial: el acta de grado, el
 * certificado de notas o la constancia de matrícula. Se emite en HTML porque
 * el navegador lo convierte a PDF con un clic (imprimir → guardar como PDF),
 * y así el gateway no necesita ninguna dependencia de maquetación.
 */

const TITULOS = {
  ACTA_GRADO: "Acta de grado",
  CERTIFICADO_NOTAS: "Certificado de notas",
  CONSTANCIA_MATRICULA: "Constancia de matrícula",
  HOMOLOGACION: "Certificado de homologación",
  ACTA_ADMISION: "Acta de admisión",
  MICROCREDENCIAL: "Microcredencial",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tablaMaterias(materias) {
  if (!Array.isArray(materias) || materias.length === 0) {
    return "<p>Sin materias registradas.</p>";
  }
  const filas = materias
    .map(
      (materia) => `<tr>
        <td>${escapeHtml(materia.codigo ?? "")}</td>
        <td>${escapeHtml(materia.materia ?? "")}</td>
        <td class="num">${escapeHtml(materia.creditos ?? "")}</td>
        <td class="num">${materia.nota === undefined ? "&mdash;" : escapeHtml(materia.nota)}</td>
        <td>${materia.aprobada === undefined ? "" : materia.aprobada ? "Aprobada" : "Reprobada"}</td>
      </tr>`,
    )
    .join("");
  return `<table>
      <thead><tr><th>Código</th><th>Materia</th><th>Cr.</th><th>Nota</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

/** Documento imprimible de la credencial. */
export function renderDocument(anchor, payload, verificationUrl) {
  const titulo = TITULOS[anchor.type] ?? "Credencial UNAC";
  const resumen = [];
  if (payload.programa) resumen.push(["Programa", payload.programa]);
  if (payload.periodo) resumen.push(["Periodo", payload.periodo]);
  if (payload.creditosTotales !== undefined) {
    resumen.push(["Créditos del pensum", payload.creditosTotales]);
  }
  if (payload.creditosAprobados !== undefined) {
    resumen.push(["Créditos aprobados", payload.creditosAprobados]);
  }
  if (payload.promedio !== undefined) resumen.push(["Promedio", payload.promedio]);
  if (payload.porcentajeAvance !== undefined) {
    resumen.push(["Avance al grado", `${payload.porcentajeAvance}%`]);
  }
  if (payload.puedeGraduarse !== undefined) {
    resumen.push(["Cumple requisitos de grado", payload.puedeGraduarse ? "Sí" : "No"]);
  }
  if (payload.creditos !== undefined) resumen.push(["Créditos matriculados", payload.creditos]);
  if (payload.institucion) resumen.push(["Institución de origen", payload.institucion]);

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titulo)} — ${escapeHtml(anchor.reference)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #0b2545; margin: 0; padding: 40px; }
  main { max-width: 820px; margin: 0 auto; }
  header { border-bottom: 3px solid #0b2545; padding-bottom: 18px; margin-bottom: 26px; }
  .marca { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #6b7a90; }
  h1 { font-size: 26px; margin: 8px 0 4px; }
  .folio { font-size: 13px; color: #6b7a90; }
  .datos { display: grid; grid-template-columns: 220px 1fr; gap: 6px 18px; margin: 22px 0; font-size: 14.5px; }
  .datos dt { font-weight: 700; }
  .datos dd { margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin: 18px 0 26px; }
  th, td { border-bottom: 1px solid #d8dee7; padding: 7px 8px; text-align: left; }
  th { background: #f2f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
  td.num { text-align: right; }
  .verificacion { border: 1px solid #d8dee7; border-left: 4px solid #1c7249; padding: 16px 18px; background: #f7faf8; font-size: 13px; }
  .verificacion code { font-size: 11px; word-break: break-all; color: #4a5a70; }
  footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #d8dee7; font-size: 11.5px; color: #6b7a90; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<main>
  <header>
    <div class="marca">Corporación Universitaria Adventista &middot; UNAC</div>
    <h1>${escapeHtml(titulo)}</h1>
    <div class="folio">Folio ${escapeHtml(anchor.reference)} &middot; Código de verificación ${escapeHtml(anchor.code)}</div>
  </header>

  <dl class="datos">
    ${resumen.map(([clave, valor]) => `<dt>${escapeHtml(clave)}</dt><dd>${escapeHtml(valor)}</dd>`).join("")}
  </dl>

  ${tablaMaterias(payload.materias)}

  <section class="verificacion">
    <strong>Documento verificable</strong><br />
    Compruebe la autenticidad en <code>${escapeHtml(verificationUrl)}</code><br />
    Hash del documento (SHA-256): <code>${escapeHtml(anchor.payloadHash)}</code><br />
    Firma institucional: <code>${escapeHtml(anchor.signature ?? "")}</code><br />
    Emitido el ${escapeHtml(new Date(anchor.signedAt).toLocaleString("es-CO"))}
  </section>

  <footer>
    Documento generado por el Portal de Admisiones y Matrícula UNAC.
    Los datos personales no se registran en la cadena de bloques: solo su huella criptográfica.
    Para imprimir o guardar como PDF use la función de impresión del navegador.
  </footer>
</main>
</body>
</html>`;
}
