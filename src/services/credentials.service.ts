import type { Credential, CredentialType } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { hashPayload } from "../utils/crypto";

function getAll(): Credential[] {
  return readList<Credential>(STORAGE_KEYS.credentials);
}

function saveAll(list: Credential[]): void {
  writeList(STORAGE_KEYS.credentials, list);
}

/**
 * Alfabeto sin caracteres ambiguos: no hay 0/O ni 1/I, para que el código
 * se pueda leer en voz alta o transcribir sin errores.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Código corto y legible para el estudiante. */
export function shortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

const REFERENCE_PREFIX: Record<CredentialType, string> = {
  ACTA_GRADO: "AG",
  CERTIFICADO_NOTAS: "CN",
  CONSTANCIA_MATRICULA: "CM",
  HOMOLOGACION: "HM",
  ACTA_ADMISION: "AD",
  MICROCREDENCIAL: "MC",
};

/** Folio institucional legible y secuencial por tipo. */
export function buildReference(type: CredentialType, index: number): string {
  return `UNAC-2026-${REFERENCE_PREFIX[type]}-${String(index).padStart(6, "0")}`;
}

/** Crea la credencial: calcula el hash del payload y la deja pendiente de anclar. */
export async function createCredential(input: {
  type: CredentialType;
  studentId?: string;
  programId?: string;
  periodId?: string;
  payload: Record<string, unknown>;
  issuedBy: string;
}): Promise<Credential> {
  const list = getAll();
  const credential: Credential = {
    id: generateId("CRD"),
    type: input.type,
    code: shortCode(),
    reference: buildReference(input.type, list.length + 1),
    studentId: input.studentId,
    programId: input.programId,
    periodId: input.periodId,
    payloadHash: await hashPayload(input.payload),
    payload: input.payload,
    status: "Pendiente",
    createdAt: new Date().toISOString(),
    issuedBy: input.issuedBy,
  };
  saveAll([...list, credential]);
  return credential;
}

export function listCredentialsFor(studentId: string): Credential[] {
  return getAll()
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAllCredentials(): Credential[] {
  return getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findByCode(code: string): Credential | undefined {
  const normalized = code.trim().toUpperCase();
  return getAll().find((item) => item.code.toUpperCase() === normalized);
}

export function findById(id: string): Credential | undefined {
  return getAll().find((item) => item.id === id);
}

export function updateCredential(id: string, patch: Partial<Credential>): Credential | undefined {
  const list = getAll();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  list[index] = { ...list[index], ...patch };
  saveAll(list);
  return list[index];
}

/** Texto legible de un tipo de credencial. */
export function credentialLabel(type: CredentialType): string {
  switch (type) {
    case "ACTA_GRADO":
      return "Acta de grado";
    case "CERTIFICADO_NOTAS":
      return "Certificado de notas";
    case "CONSTANCIA_MATRICULA":
      return "Constancia de matrícula";
    case "HOMOLOGACION":
      return "Certificado de homologación";
    case "ACTA_ADMISION":
      return "Acta de admisión";
    case "MICROCREDENCIAL":
      return "Microcredencial";
    default:
      return "Credencial";
  }
}
