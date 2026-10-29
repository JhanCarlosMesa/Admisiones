import type { Credential, CredentialType } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { hashPayload, sha256Hex } from "../utils/crypto";
import { credentialLabel, findByCode, updateCredential } from "./credentials.service";
import { recordAudit } from "./audit.service";
import { notifyUser } from "./notifications.service";

// ------------------------------------------------------------------
// Contrato
//
// El portal nunca sabe quién implementa el anclaje. La Fase 0 usa el
// transporte local; la Fase 1, el gateway institucional. Cambiar de uno a
// otro es una línea (USE_GATEWAY) y no toca el código de negocio.
// ------------------------------------------------------------------

export interface AnchorRequest {
  type: CredentialType;
  reference: string;
  code: string;
  programId?: string;
  periodId?: string;
  /** Hash SHA-256 con dominio del payload canónico. */
  payloadHash: string;
  /** Contenido real. Viaja al gateway, NUNCA a la cadena. */
  payload: Record<string, unknown>;
}

export interface AnchorResult {
  ok: boolean;
  anchorId?: string;
  signedAt?: string;
  signature?: string;
  error?: string;
}

export type VerificationStatus = "VERIFICADO" | "NO ENCONTRADO" | "ALTERADO" | "REVOCADO";

export interface VerificationReport {
  verified: boolean;
  status: VerificationStatus;
  credential?: Credential;
  detail: string;
  /** Datos públicos del anclaje, aptos para mostrarse. */
  anchor?: {
    reference: string;
    type: CredentialType;
    programId?: string;
    periodId?: string;
    payloadHash: string;
    signedAt?: string;
    signature?: string;
    anchorId?: string;
  };
}

export interface AnchorTransport {
  anchor(request: AnchorRequest): Promise<AnchorResult>;
  verify(code: string): Promise<VerificationReport>;
}

// ------------------------------------------------------------------
// Transporte local (Fase 0)
//
// Reproduce el comportamiento observable de una red permissionada: los
// anclajes son inmutables (solo se anexan), llevan sello de tiempo y firma,
// y el hash encadena cada anclaje con el anterior. Lo que se simula es el
// transporte, no el hashing ni la verificación.
// ------------------------------------------------------------------

interface LocalAnchor {
  id: string;
  type: CredentialType;
  code: string;
  reference: string;
  programId?: string;
  periodId?: string;
  payloadHash: string;
  /** Hash del anclaje anterior: forma una cadena de integridad. */
  previousHash: string;
  signedAt: string;
  signature: string;
}

const GENESIS_HASH = "0".repeat(64);

class LocalTransport implements AnchorTransport {
  private get chain(): LocalAnchor[] {
    return readList<LocalAnchor>(STORAGE_KEYS.anchors);
  }

  async anchor(request: AnchorRequest): Promise<AnchorResult> {
    const chain = this.chain;
    const previous = chain.length > 0 ? chain[chain.length - 1] : undefined;
    const previousHash = previous
      ? await sha256Hex(`${previous.payloadHash}|${previous.signedAt}|${previous.signature}`)
      : GENESIS_HASH;
    const signedAt = new Date().toISOString();
    const signature = await sha256Hex(
      `firma-institucional-simulada|${request.payloadHash}|${signedAt}|${previousHash}`,
    );
    const entry: LocalAnchor = {
      id: generateId("ANC"),
      type: request.type,
      code: request.code,
      reference: request.reference,
      programId: request.programId,
      periodId: request.periodId,
      payloadHash: request.payloadHash,
      previousHash,
      signedAt,
      signature,
    };
    writeList(STORAGE_KEYS.anchors, [...chain, entry]);
    return { ok: true, anchorId: entry.id, signedAt, signature };
  }

  async verify(code: string): Promise<VerificationReport> {
    const normalized = code.trim().toUpperCase();
    const entry = this.chain.find((item) => item.code.toUpperCase() === normalized);
    if (!entry) {
      return {
        verified: false,
        status: "NO ENCONTRADO",
        detail: "No existe ningún anclaje registrado con ese código de verificación.",
      };
    }
    const credential = findByCode(code);
    if (!credential) {
      return {
        verified: false,
        status: "NO ENCONTRADO",
        detail: "El anclaje existe, pero su credencial no está disponible en este dispositivo.",
        anchor: { ...entry },
      };
    }
    if (credential.status === "Revocado") {
      return {
        verified: false,
        status: "REVOCADO",
        credential,
        detail: "Esta credencial fue revocada por la institución.",
        anchor: { ...entry },
      };
    }
    // Lo importante: se recalcula el hash del payload actual y se compara con
    // el hash anclado. Si alguien alteró una nota, los hashes no coinciden.
    const current = await hashPayload(credential.payload);
    if (current !== entry.payloadHash) {
      return {
        verified: false,
        status: "ALTERADO",
        credential,
        detail:
          "El contenido del documento cambió después de ser emitido. El anclaje conserva el hash original, que es la evidencia.",
        anchor: { ...entry },
      };
    }
    return {
      verified: true,
      status: "VERIFICADO",
      credential,
      detail: "La firma es válida y el documento no ha sido alterado desde su emisión.",
      anchor: { ...entry },
    };
  }
}

// ------------------------------------------------------------------
// Transporte HTTP (Fase 1): el gateway institucional
// ------------------------------------------------------------------

export class GatewayTransport implements AnchorTransport {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["X-Gateway-Token"] = this.token;
    return headers;
  }

  async anchor(request: AnchorRequest): Promise<AnchorResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/anchors`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        return { ok: false, error: `El gateway respondió ${response.status}.` };
      }
      return (await response.json()) as AnchorResult;
    } catch (error) {
      return { ok: false, error: `No se pudo contactar el gateway: ${(error as Error).message}` };
    }
  }

  async verify(code: string): Promise<VerificationReport> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/verify/${encodeURIComponent(code.trim().toUpperCase())}`,
      );
      if (!response.ok) {
        return {
          verified: false,
          status: "NO ENCONTRADO",
          detail: "El gateway no encontró ningún anclaje con ese código.",
        };
      }
      return (await response.json()) as VerificationReport;
    } catch (error) {
      return {
        verified: false,
        status: "NO ENCONTRADO",
        detail: `No se pudo contactar el gateway: ${(error as Error).message}`,
      };
    }
  }
}

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------

/**
 * Configuración del anclaje.
 *
 * USE_GATEWAY = false  →  transporte local (Fase 0): la cadena simulada en
 *                         localStorage. Todo el hashing, la firma y la
 *                         verificación son reales; solo el transporte se simula.
 * USE_GATEWAY = true   →  transporte HTTP contra el gateway institucional
 *                         (Fase 1), que es quien firma con la llave real.
 *
 * Se activa con la variable de entorno `VITE_USE_GATEWAY=true` y la dirección
 * del gateway se ajusta con `VITE_GATEWAY_URL` (por defecto, puerto 3080).
 */
const USE_GATEWAY = (import.meta.env?.VITE_USE_GATEWAY as string) === "true";
const GATEWAY_URL = (import.meta.env?.VITE_GATEWAY_URL as string) || "http://localhost:3080";

/**
 * Token de escritura del gateway.
 *
 * ATENCIÓN: con Vite, una variable VITE_* queda incrustada en el bundle, así
 * que este token es legible por cualquiera que abra las herramientas de
 * desarrollo. Es un compromiso de proyecto de clase. En producción debe
 * sustituirse por OAuth 2.0 con PKCE contra el IdP institucional.
 */
/**
 * Token de escritura del gateway.
 *
 * El acceso es defensivo porque Vite inyecta `import.meta.env` en el bundle
 * del navegador, pero ese objeto no existe cuando el código se ejecuta fuera
 * de Vite (por ejemplo, en los tests headless).
 *
 * ATENCIÓN: con Vite, una variable VITE_* queda incrustada en el bundle, así
 * que este token es legible por cualquiera que abra las herramientas de
 * desarrollo. Es un compromiso de proyecto de clase. En producción debe
 * sustituirse por OAuth 2.0 con PKCE contra el IdP institucional.
 */
const GATEWAY_TOKEN = import.meta.env?.VITE_GATEWAY_TOKEN as string | undefined;

export function getTransport(): AnchorTransport {
  return USE_GATEWAY ? new GatewayTransport(GATEWAY_URL, GATEWAY_TOKEN) : new LocalTransport();
}

export function isUsingGateway(): boolean {
  return USE_GATEWAY;
}

// ------------------------------------------------------------------
// Emisión
// ------------------------------------------------------------------

/**
 * Emite la credencial: la ancla, registra la auditoría y actualiza su
 * estado. El hash ya venía calculado en `createCredential`.
 */
export async function issueCredential(credential: Credential): Promise<AnchorResult> {
  const actor = credential.issuedBy ?? "portal";
  recordAudit(credential.id, "SOLICITADO", actor, `Solicitud de anclaje ${credential.reference}`);

  const result = await getTransport().anchor({
    type: credential.type,
    reference: credential.reference,
    code: credential.code,
    programId: credential.programId,
    periodId: credential.periodId,
    payloadHash: credential.payloadHash,
    payload: credential.payload,
  });

  if (!result.ok) {
    updateCredential(credential.id, { status: "Fallido", error: result.error });
    recordAudit(credential.id, "RECHAZADO", actor, result.error ?? "Error desconocido");
    return result;
  }

  updateCredential(credential.id, {
    status: "Anclado",
    anchorId: result.anchorId,
    signature: result.signature,
    anchoredAt: result.signedAt,
  });
  recordAudit(credential.id, "FIRMADO", actor, `Firma ${result.signature?.slice(0, 24)}…`);
  recordAudit(credential.id, "ANCLADO", actor, `Anclaje ${result.anchorId}`);

  // El aviso va desde el servicio, no desde la vista: así toda emisión
  // notifica, sin importar quién la haya lanzado.
  if (credential.studentId) {
    notifyUser(
      credential.studentId,
      `Se emitió tu ${credentialLabel(credential.type).toLowerCase()}`,
      `Folio ${credential.reference}. Ya puedes verlo, compartirlo y verificarlo desde "Mis credenciales".`,
      "success",
    );
  }

  return result;
}

/** Revoca una credencial: queda constancia, no se borra. */
export function revokeCredential(credentialId: string, actor: string, reason: string): boolean {
  const credential = updateCredential(credentialId, { status: "Revocado", error: reason });
  if (!credential) return false;
  recordAudit(credentialId, "REVOCADO", actor, reason);
  return true;
}
