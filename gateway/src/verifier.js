import { createHash } from "node:crypto";
import { verifyHash } from "./signer.js";

/**
 * Verificador de credenciales.
 *
 * Comprueba tres cosas, en este orden:
 *  1. que exista un anclaje con ese código;
 *  2. que la firma institucional del hash sea válida;
 *  3. que el documento que se presenta tenga el mismo hash que el anclado.
 *
 * El paso 3 es el que detecta una alteración: si alguien cambia una nota
 * después de emitir el acta, el hash del documento deja de coincidir con el
 * hash anclado, aunque la firma siga siendo válida.
 */

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/** Hash con dominio, idéntico al que calcula el portal. */
export function hashPayload(payload) {
  return createHash("sha256")
    .update(`UNAC|v1|${canonicalJson(payload)}`)
    .digest("hex");
}

export async function verifyCredential(relay, code) {
  const entry = await relay.findByCode(code);
  if (!entry) {
    return {
      verified: false,
      status: "NO ENCONTRADO",
      detail: "No existe ningún anclaje registrado con ese código de verificación.",
    };
  }

  const firmaValida = verifyHash(entry.payloadHash, entry.signature);
  if (!firmaValida) {
    return {
      verified: false,
      status: "ALTERADO",
      detail: "La firma institucional no valida para este anclaje.",
      anchor: publicAnchor(entry),
    };
  }

  return {
    verified: true,
    status: "VERIFICADO",
    detail: "La firma es válida y el documento no ha sido alterado desde su emisión.",
    anchor: publicAnchor(entry),
  };
}

/**
 * Verifica un documento presentado contra el anclaje: recalcula el hash del
 * contenido y lo compara con el anclado.
 */
export function verifyDocument(entry, payload) {
  const actual = hashPayload(payload);
  if (actual !== entry.payloadHash) {
    return {
      verified: false,
      status: "ALTERADO",
      detail:
        "El contenido del documento cambió después de ser emitido. El anclaje conserva el hash original, que es la evidencia.",
      anchor: publicAnchor(entry),
    };
  }
  return {
    verified: true,
    status: "VERIFICADO",
    detail: "La firma es válida y el documento no ha sido alterado desde su emisión.",
    anchor: publicAnchor(entry),
  };
}

/** Datos públicos de un anclaje: sin datos personales. */
export function publicAnchor(entry) {
  return {
    anchorId: entry.id,
    type: entry.type,
    code: entry.code,
    reference: entry.reference,
    programId: entry.programId ?? undefined,
    periodId: entry.periodId ?? undefined,
    payloadHash: entry.payloadHash,
    signedAt: entry.signedAt,
    signature: entry.signature,
  };
}
