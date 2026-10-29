# Guía de Implementación de Blockchain en el Portal de Admisiones UNAC

**Cómo llevar a cabo, paso a paso, la propuesta de `Propuesta Blockchain Admisiones.pdf` sobre el código real del portal.**

**Estado del proyecto al escribir esta guía:** esquema de datos v7 · 13 servicios · 20 vistas · 100 estudiantes de prueba · front-end puro (sin backend).

---

## 0. Cómo usar esta guía

La guía está ordenada en **pasos ejecutables**. Cada paso:

- tiene un objetivo claro,
- toca un número pequeño de ficheros,
- **deja el proyecto funcionando** (compila, corre y se puede verificar),
- y termina con una comprobación concreta de que salió bien.

**Regla de oro: no avances al paso siguiente hasta que el anterior esté verificado.** La verificación de cada fase es un script headless (ya existe el patrón en `verify-nivel1.mjs`), no una prueba manual en el navegador.

**Alcance de esta guía:** solo el código del portal y el servicio del gateway. No entra en la infraestructura de despliegue (la instancia, el bucket, el pipeline), porque nada de eso cambia entre la Fase 0 y la Fase 1: el portal y el gateway son dos procesos y una ruta más.

| Fase | Qué se construye | Esfuerzo | ¿Toca la red? |
|------|------------------|-----------|----------------|
| **Fase 0** | Todo el lado del cliente: hashing real, credenciales, emisión, verificación | ~1 semana | No |
| **Fase 1** | El gateway institucional + red de pruebas | ~2-3 semanas | Sí |
| **Fase 2** | Migración del transporte simulado al real + producción | ~1 semana | Sí |

### Estado de implementación (26 de octubre de 2026)

| Paso | Estado | Dónde quedó |
|------|--------|-------------|
| 0.1 Primitivas criptográficas | ✅ Hecho | `src/utils/crypto.ts` — `canonicalJson`, `sha256Hex`, `hashPayload` |
| 0.2 Tipos y claves | ✅ Hecho | `src/types.ts` (`Credential`, `AnchorAudit`), `src/data/keys.ts`, esquema **v8** |
| 0.3 Servicio de credenciales | ✅ Hecho | `src/services/credentials.service.ts` |
| 0.4 Transporte simulado | ✅ Hecho | `src/services/anchoring.service.ts` — `LocalTransport` + `GatewayTransport` |
| 0.5 Bitácora de auditoría | ✅ Hecho | `src/services/audit.service.ts` |
| 0.6 Payloads desde funciones reales | ✅ Hecho | `src/services/payloads.service.ts` |
| 0.7 Vistas | ✅ Hecho | `src/views/issuance.view.ts`, `credentials.view.ts`, `verify.view.ts` |
| 0.8 Rutas y navegación | ✅ Hecho | `src/router.ts`, `src/utils/dom.ts` |
| 0.9 Verificación automatizada | ✅ Hecho | `verify-anchors.mjs` — 45 comprobaciones |
| 1.1 Firmante Ed25519 | ✅ Hecho | `gateway/src/signer.js` |
| 1.2 Relay | ✅ Hecho | `gateway/src/chain.js` — modo `file` (cadena encadenada) y modo `network` |
| 1.3 Verificador | ✅ Hecho | `gateway/src/verifier.js` |
| 1.4 API + autenticación | ✅ Hecho | `gateway/src/server.js` — 9 rutas |
| 1.5 Correrlo en local | ✅ Hecho | `gateway/` — `npm run keys` + `npm run dev`, sin dependencias |
| 2.1 Activar el transporte real | ⚪ Pendiente | Cambiar `USE_GATEWAY` a `true` en `src/services/anchoring.service.ts` |
| 2.2 PDF firmados | ⚪ Pendiente | `gateway/src/issuer.js` ya genera el documento imprimible en HTML |
| 2.3 QR en el documento | ⚪ Pendiente | Hoy el QR se pide a un servicio externo desde la vista del estudiante |
| 2.4 Revocación operativa | ⚪ Pendiente | El gateway ya expone `POST /api/v1/revocations`; falta el botón en la UI |
| 2.5 Migrar a base de datos | ⚪ Pendiente | Ahora las credenciales viven en `localStorage` |

**Verificación:** `verify-anchors.mjs` (portal, 45 comprobaciones) y `verify-gateway.mjs`
(gateway de punta a punta, 33 comprobaciones) pasan en verde.

> **Detalle de canonicalización que costó una corrección:** el hash debe calcularse
> con el JSON **canónico** (claves ordenadas). Si el portal, el gateway y el
> test calculan el hash de forma distinta, la verificación responde `ALTERADO`
> aunque el documento esté intacto. Las tres implementaciones deben usar la
> misma función.

**La Fase 0 es la que más valor da por unidad de esfuerzo**, y es la única que se puede hacer sin pedir nada a nadie. Al final de la Fase 0 ya tienes un sistema de credenciales verificables funcionando dentro del portal, con el hashing y la lógica de verificación reales. La Fase 1 solo cambia *quién escribe el anclaje*, no el resto.

---

## 1. La decisión de arquitectura que hace esto posible

El portal no tiene backend. Y **un navegador no puede escribir en una cadena de bloques de forma confiable**:

- no custodia la llave institucional (si se distribuyera al cliente, cualquiera que abra DevTools podría firmar diplomas);
- no puede garantizar que la transacción se registró;
- y expone la superficie de ataque completa.

Por eso la arquitectura tiene tres capas (ver §4 de la propuesta):

```
Portal (SPA)  ──HTTPS──▶  Gateway institucional  ──▶  Red permisionada
  off-chain                    (firma + ancla)         (solo hashes)
```

### 1.1 La clave: un transporte intercambiable

Si escribes el cliente *atado* a un `fetch` al gateway, la Fase 0 te obliga a mockear el `fetch` y la Fase 1 te obliga a reescribir el cliente. En su lugar, define **una interfaz** y **dos implementaciones**:

```ts
// src/services/anchoring.service.ts

export interface AnchorRequest {
  type: CredentialType;
  reference: string;
  code: string;
  programId?: string;
  periodId?: string;
  /** Hash SHA-256 del payload canónico. */
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

export interface VerificationReport {
  verified: boolean;
  status: "VERIFICADO" | "NO ENCONTRADO" | "ALTERADO" | "REVOCADO";
  credential?: Credential;
  detail: string;
}

/** Contrato único. La app no sabe quién implementa el anclaje. */
export interface AnchorTransport {
  anchor(request: AnchorRequest): Promise<AnchorResult>;
  verify(code: string): Promise<VerificationReport>;
}
```

Con esto, la transición de la Fase 0 a la Fase 1 es **una línea**:

```ts
// src/services/anchoring.service.ts
const USE_GATEWAY = false;   // Fase 0: false  →  Fase 1: true

export function getTransport(): AnchorTransport {
  return USE_GATEWAY ? new GatewayTransport() : new LocalTransport();
}
```

Todo el código de negocio (emitir, listar, verificar, notificar) no se toca.

### 1.2 Qué se puede y qué no se puede hacer en el navegador

| Se puede (y es real) | No se puede (y hay que decirlo) |
|---|---|
| Calcular el hash SHA-256 canónico del documento | Firmar con la llave institucional |
| Canonicalizar el JSON para que el hash sea reproducible | Escribir en una red real |
| Verificar que un documento **cambió** (recalcular y comparar) | Que un tercero desde **otro** navegador verifique (en Fase 0) |
| Generar el código de verificación y la URL | Guardar el PDF en un almacén privado |
| Modelar toda la bitácora de auditoría | Que el ancla sobreviva a que el estudiante borre sus datos |

> **Honestidad para el profesor:** en la Fase 0 el "hash es real, la red es simulada". Eso no es una trampa: el hash, la canonicalización y la verificación son el 90 % del trabajo criptográfico real, y no cambian al pasar a la red verdadera. Lo que se simula es **el último mile**: el transporte.

---

## 2. Fase 0 — Paso a paso

### Paso 0.1 — Primitivas criptográficas

**Objetivo:** poder hashear un documento de forma que cualquiera pueda recalcular el mismo hash.

**Fichero:** `src/utils/crypto.ts` (añadir al final)

```ts
/**
 * Serialización canónica: el mismo objeto produce siempre el mismo texto.
 * Las claves se ordenan alfabéticamente para que el orden de inserción
 * del objeto no altere el hash. Sin esto, dos sistemas que construyan
 * el mismo documento en distinto orden obtendrían hashes distintos.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/** Hash SHA-256 sin sal, para payloads que un tercero debe poder recomputar. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(digest);
}

/**
 * Hash con dominio ("UNAC|v1|"). El prefijo impide que alguien con
 * un documento corto adivine su hash por fuerza bruta (ataque de preimagen).
 */
export async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(`UNAC|v1|${canonicalJson(payload)}`);
}
```

**Por qué `crypto.subtle`:** ya lo usa `hashPassword()`. No se añade ninguna dependencia. Ojo: `crypto.subtle` **solo existe en contexto seguro** (`https://` o `localhost`). En `http://192.168.x.x` fallará — para probar en la red local usa `localhost` o `vite --host` con HTTPS.

**Verificación:** añade a `verify-nivel1.mjs`:

```ts
const { canonicalJson, hashPayload } = await import("./src/utils/crypto.ts");
check(
  "el hash no depende del orden de las claves",
  (await hashPayload({ b: 2, a: 1 })) === (await hashPayload({ a: 1, b: 2 })),
);
check("el hash cambia si cambia un valor", (await hashPayload({ a: 1 })) !== (await hashPayload({ a: 2 })));
```

---

### Paso 0.2 — Tipos y claves de almacenamiento

**Objetivo:** definir el contrato de datos.

**Fichero:** `src/types.ts` (añadir al final)

```ts
export type CredentialType =
  | "ACTA_GRADO"
  | "CERTIFICADO_NOTAS"
  | "CONSTANCIA_MATRICULA"
  | "HOMOLOGACION"
  | "ACTA_ADMISION"
  | "MICROCREDENCIAL";

export type AnchorStatus = "Pendiente" | "Anclado" | "Fallido" | "Revocado";

export interface Credential {
  id: string;
  type: CredentialType;
  /** Código corto que el estudiante comparte. Ej: 7F3K2D */
  code: string;
  /** Folio institucional legible. Ej: UNAC-2026-000145 */
  reference: string;
  studentId?: string;
  programId?: string;
  periodId?: string;
  /** Hash SHA-256 del payload canónico. */
  payloadHash: string;
  /** Contenido real del documento. NUNCA se envía a la cadena. */
  payload: Record<string, unknown>;
  status: AnchorStatus;
  anchorId?: string;
  signature?: string;
  error?: string;
  createdAt: string;
  anchoredAt?: string;
  issuedBy?: string;
}

export interface AnchorAudit {
  id: string;
  credentialId: string;
  action: "SOLICITADO" | "FIRMADO" | "ANCLADO" | "RECHAZADO" | "REVOCADO";
  actor: string;
  detail: string;
  createdAt: string;
}
```

**Fichero:** `src/data/keys.ts`

```ts
export const STORAGE_KEYS = {
  // …lo que ya existe…
  credentials: "unac-credentials",
  anchorAudit: "unac-anchor-audit",
  /** La "cadena" simulada de la Fase 0. */
  anchors: "unac-anchors",
} as const;
```

**Sube `SCHEMA_VERSION` a `"8"`** en `src/data/seed.ts` y la clave `seeded` a `"unac-seeded-v8"`, y añade a la lista de `localStorage.removeItem(...)` del seed: `credentials`, `anchorAudit`, `anchors`.

> ⚠️ Subir la versión **borra** las tareas, notas y matrículas sembradas, y las vuelve a crear. Las cuentas y las solicitudes del usuario se conservan.

---

### Paso 0.3 — Servicio de credenciales

**Objetivo:** construir el payload, calcular su hash y registrar la credencial.

**Fichero nuevo:** `src/services/credentials.service.ts`

```ts
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

/** Código corto y legible: sin caracteres ambiguos (0/O, 1/I). */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function shortCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Folio institucional legible y secuencial por año. */
export function buildReference(type: CredentialType, index: number): string {
  const prefix: Record<CredentialType, string> = {
    ACTA_GRADO: "AG",
    CERTIFICADO_NOTAS: "CN",
    CONSTANCIA_MATRICULA: "CM",
    HOMOLOGACION: "HM",
    ACTA_ADMISION: "AD",
    MICROCREDENCIAL: "MC",
  };
  return `UNAC-2026-${prefix[type]}-${String(index).padStart(6, "0")}`;
}

export async function createCredential(input: {
  type: CredentialType;
  studentId?: string;
  programId?: string;
  periodId?: string;
  payload: Record<string, unknown>;
  issuedBy: string;
}): Promise<Credential> {
  const list = getAll();
  const type = input.type;
  const credential: Credential = {
    id: generateId("CRD"),
    type,
    code: shortCode(),
    reference: buildReference(type, list.length + 1),
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
```

**Verificación:** el hash debe cambiar si cambia una nota del payload. Añadir al script:

```ts
const cred = await createCredential({ type: "ACTA_GRADO", payload: { promedio: 4.2 }, issuedBy: "test" });
check("la credencial guarda el hash del payload", cred.payloadHash.length === 64);
check("el código tiene 6 caracteres", cred.code.length === 6);
```

---

### Paso 0.4 — El transporte simulado

**Objetivo:** escribir el contrato y su implementación local.

**Fichero nuevo:** `src/services/anchoring.service.ts`

```ts
import type { AnchorStatus, Credential, CredentialType } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { hashPayload, sha256Hex } from "../utils/crypto";
import { findByCode, updateCredential } from "./credentials.service";
import { recordAudit } from "./audit.service";

export interface AnchorRequest { /* …ver §1.1… */ }
export interface AnchorResult { /* … */ }
export interface VerificationReport { /* … */ }
export interface AnchorTransport {
  anchor(request: AnchorRequest): Promise<AnchorResult>;
  verify(code: string): Promise<VerificationReport>;
}

/** Registro en la "cadena" simulada. */
interface SimulatedAnchor {
  id: string;
  type: CredentialType;
  code: string;
  reference: string;
  programId?: string;
  periodId?: string;
  payloadHash: string;
  signedAt: string;
  /** Firma placeholder. En Fase 1 la produce el gateway. */
  signature: string;
}

/**
 * Transporte local de la Fase 0: guarda el anclaje en localStorage.
 * Reproduce el comportamiento observable de la red (inmutable, con
 * sello de tiempo y firma) sin necesidad de infraestructura.
 */
class LocalTransport implements AnchorTransport {
  private get chain(): SimulatedAnchor[] {
    return readList<SimulatedAnchor>(STORAGE_KEYS.anchors);
  }

  async anchor(request: AnchorRequest): Promise<AnchorResult> {
    const signedAt = new Date().toISOString();
    const signature = await sha256Hex(`firma-simulada|${request.payloadHash}|${signedAt}`);
    const entry: SimulatedAnchor = {
      id: generateId("ANC"),
      type: request.type,
      code: request.code,
      reference: request.reference,
      programId: request.programId,
      periodId: request.periodId,
      payloadHash: request.payloadHash,
      signedAt,
      signature,
    };
    writeList(STORAGE_KEYS.anchors, [...this.chain, entry]);
    return { ok: true, anchorId: entry.id, signedAt, signature };
  }

  async verify(code: string): Promise<VerificationReport> {
    const entry = this.chain.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
    if (!entry) {
      return { verified: false, status: "NO ENCONTRADO", detail: "No existe ningún anclaje con ese código." };
    }
    const credential = findByCode(code);
    if (!credential) {
      return { verified: false, status: "NO ENCONTRADO", detail: "El anclaje no tiene credencial asociada." };
    }
    if (credential.status === "Revocado") {
      return { verified: false, status: "REVOCADO", credential, detail: "Esta credencial fue revocada por la institución." };
    }
    // Lo importante: se recalcula el hash del payload actual y se compara.
    const current = await hashPayload(credential.payload);
    if (current !== entry.payloadHash) {
      return {
        verified: false,
        status: "ALTERADO",
        credential,
        detail: "El contenido del documento cambió después de emitido. El anclaje conserva el hash original.",
      };
    }
    return { verified: true, status: "VERIFICADO", credential, detail: "La firma es válida y el documento no ha sido alterado." };
  }
}

/** Transporte HTTP contra el gateway institucional. Se activa en la Fase 1. */
class GatewayTransport implements AnchorTransport {
  constructor(private baseUrl = "") {}

  async anchor(request: AnchorRequest): Promise<AnchorResult> {
    const response = await fetch(`${this.baseUrl}/api/v1/anchors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      return { ok: false, error: `El gateway respondió ${response.status}.` };
    }
    return (await response.json()) as AnchorResult;
  }

  async verify(code: string): Promise<VerificationReport> {
    const response = await fetch(`${this.baseUrl}/api/v1/verify/${encodeURIComponent(code)}`);
    if (!response.ok) {
      return { verified: false, status: "NO ENCONTRADO", detail: "El gateway no encontró el anclaje." };
    }
    return (await response.json()) as VerificationReport;
  }
}

const USE_GATEWAY = false;

export function getTransport(): AnchorTransport {
  return USE_GATEWAY ? new GatewayTransport() : new LocalTransport();
}

/** Emite la credencial: la crea, la ancla y actualiza su estado. */
export async function issueCredential(credential: Credential): Promise<AnchorResult> {
  recordAudit(credential.id, "SOLICITADO", credential.issuedBy ?? "portal", `Solicitud de anclaje ${credential.reference}`);
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
    recordAudit(credential.id, "RECHAZADO", credential.issuedBy ?? "portal", result.error ?? "Error desconocido");
    return result;
  }
  updateCredential(credential.id, {
    status: "Anclado",
    anchorId: result.anchorId,
    signature: result.signature,
    anchoredAt: result.signedAt,
  });
  recordAudit(credential.id, "ANCLADO", credential.issuedBy ?? "portal", `Anclaje ${result.anchorId}`);
  return result;
}
```

**Ojo con el orden de los imports:** `anchoring.service.ts` importa de `audit.service.ts`, y `audit.service.ts` **no** debe importar de `anchoring.service.ts` (ciclo). Créalo primero, como en el paso 0.5, aunque el orden de los pasos diga lo contrario: por eso el paso 0.5 va antes en la práctica.

---

### Paso 0.5 — Bitácora de auditoría

**Fichero nuevo:** `src/services/audit.service.ts`

```ts
import type { AnchorAudit } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function recordAudit(
  credentialId: string,
  action: AnchorAudit["action"],
  actor: string,
  detail: string,
): AnchorAudit {
  const entry: AnchorAudit = {
    id: generateId("AUD"),
    credentialId,
    action,
    actor,
    detail,
    createdAt: new Date().toISOString(),
  };
  writeList(STORAGE_KEYS.anchorAudit, [...readList<AnchorAudit>(STORAGE_KEYS.anchorAudit), entry]);
  return entry;
}

export function listAuditFor(credentialId: string): AnchorAudit[] {
  return readList<AnchorAudit>(STORAGE_KEYS.anchorAudit)
    .filter((item) => item.credentialId === credentialId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listAllAudit(): AnchorAudit[] {
  return readList<AnchorAudit>(STORAGE_KEYS.anchorAudit)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
```

---

### Paso 0.6 — Construir los payloads desde las funciones que ya existen

**Este es el paso que conecta blockchain con el portal real.** Los payloads se construyen con las funciones de negocio que ya existen, no con datos inventados.

**Fichero nuevo:** `src/services/payloads.service.ts`

```ts
import type { CredentialType } from "../types";
import { graduationProgress, listGradedCourses, gradeAverage } from "./grades.service";
import { getActiveEnrollments, creditsInUse } from "./enrollment.service";
import { getProgram } from "./catalog.service";

/** Payload del acta de grado: usa el veredicto de graduación real. */
export async function buildGraduationPayload(studentId: string, programId: string) {
  const progress = graduationProgress(studentId, programId);
  const program = getProgram(programId);
  const courses = listGradedCourses(studentId).map((item) => ({
    codigo: item.course.code,
    materia: item.course.name,
    creditos: item.course.credits,
    nota: item.grade,
    periodo: item.periodId,
    aprobada: item.approved,
  }));
  return {
    tipo: "ACTA_GRADO",
    programa: program?.name ?? programId,
    plan: programId,
    creditosTotales: progress.totalCredits,
    creditosAprobados: progress.earnedCredits,
    porcentajeAvance: progress.percent,
    promedio: Number(gradeAverage(studentId).toFixed(2)),
    puedeGraduarse: progress.canGraduate,
    materias: courses,
    emitido: new Date().toISOString(),
  };
}

/** Payload del certificado de notas de un periodo. */
export function buildTranscriptPayload(studentId: string, periodId: string) {
  const courses = listGradedCourses(studentId)
    .filter((item) => item.periodId === periodId)
    .map((item) => ({
      codigo: item.course.code,
      materia: item.course.name,
      creditos: item.course.credits,
      nota: item.grade,
      aprobada: item.approved,
    }));
  return {
    tipo: "CERTIFICADO_NOTAS",
    periodo: periodId,
    promedio: Number(gradeAverage(studentId).toFixed(2)),
    materias: courses,
    emitido: new Date().toISOString(),
  };
}

/** Payload de la constancia de matrícula. */
export function buildEnrollmentPayload(studentId: string, programId: string, periodId: string) {
  const enrollments = getActiveEnrollments(studentId, periodId);
  return {
    tipo: "CONSTANCIA_MATRICULA",
    programa: getProgram(programId)?.name ?? programId,
    periodo: periodId,
    creditos: creditsInUse(studentId, periodId),
    materias: enrollments.map((item) => item.offeringId),
    emitido: new Date().toISOString(),
  };
}
```

> **Nota de diseño:** el payload de la constancia incluye `offeringId` y no la lista de materias con nombre, porque el *payload* sí contiene datos que no deben ir a la cadena. Recuerda: **el payload viaja al gateway pero nunca a la cadena**; a la cadena solo va su hash. Aun así, minimiza lo que mandas.

---

### Paso 0.7 — Vistas

Tres vistas nuevas. Aquí van las partes no obvias; el resto es el mismo patrón que las demás vistas del portal.

**`src/views/issuance.view.ts`** (Staff, ruta `#issuance`)

Lo mínimo: listar estudiantes con admisión aprobada, dejar elegir el tipo de credencial, construir el payload, emitir.

```ts
const PROGRAMAS = ["ACTA_GRADO", "CERTIFICADO_NOTAS", "CONSTANCIA_MATRICULA"] as const;

async function emitir(account: Account, studentId: string, type: CredentialType) {
  const admission = listByApplicant(studentId).find((a) => a.status === "Admitido");
  if (!admission) { setFormMessage("El estudiante no tiene una admisión aprobada.", "error"); return; }
  const period = getActivePeriod();
  const payload = type === "ACTA_GRADO"
    ? await buildGraduationPayload(studentId, admission.programId)
    : type === "CERTIFICADO_NOTAS"
      ? buildTranscriptPayload(studentId, period?.id ?? "")
      : buildEnrollmentPayload(studentId, admission.programId, period?.id ?? "");

  const credential = await createCredential({
    type, studentId, programId: admission.programId, periodId: period?.id,
    payload, issuedBy: account.email,
  });
  const result = await issueCredential(credential);
  if (!result.ok) { setFormMessage(result.error ?? "No se pudo anclar.", "error"); return; }
  notifyUser(studentId, "Se emitió una credencial a tu nombre",
    `Tu ${labelFor(type)} fue emitido y anclado. Puedes verlo y compartirlo desde "Mis credenciales".`,
    "success");
  renderIssuanceView(account);
}
```

**`src/views/credentials.view.ts`** (Estudiante, ruta `#credentials`)

Lista sus credenciales con: tipo, folio, código, fecha, estado y la URL de verificación. **En la Fase 0 el QR no se genera** (generar un QR sin librería son ~200 líneas): muestra el código y la URL, y el QR llega en la Fase 1 con el PDF.

```ts
const url = `${location.origin}/#verify?code=${credential.code}`;
```

**`src/views/verify.view.ts`** (Público, ruta `#verify`)

Esta vista **funciona sin sesión**. Es el requisito número uno de la rúbrica: "verificación pública instantánea sin fricción".

```ts
export async function renderVerifyView(query: URLSearchParams): Promise<void> {
  const code = query.get("code") ?? "";
  const report = await getTransport().verify(code);
  // … render del reporte: VERIFICADO / NO ENCONTRADO / ALTERADO / REVOCADO …
}
```

Como el `router.ts` llama a las vistas de forma síncrona, necesitas que `route()` la soporte:

```ts
// src/router.ts
if (path === "verify") { void renderVerifyView(query); return; }
```

**Ojo:** `renderShell()` exige el `account` opcional — `renderShell(html, "Verificar", undefined)` funciona (ya lo usa `public.view.ts`).

---

### Paso 0.8 — Rutas y navegación

**`src/router.ts`**

```ts
import { renderIssuanceView } from "./views/issuance.view";
import { renderCredentialsView } from "./views/credentials.view";
import { renderVerifyView } from "./views/verify.view";

// …dentro de route(), ANTES del bloque que exige sesión:
if (path === "verify") { void renderVerifyView(query); return; }

// …después, con control de rol:
if (path === "credentials") {
  if (account.role !== "Estudiante") { location.hash = "home"; return; }
  return renderCredentialsView(account);
}
if (path === "issuance") {
  if (account.role !== "Staff") { location.hash = "home"; return; }
  return renderIssuanceView(account);
}
```

**`src/utils/dom.ts`** — en `buildNav(account)`:

```ts
if (account.role === "Estudiante") links.push('<a href="#credentials">Mis credenciales</a>');
if (account.role === "Staff") links.push('<a href="#issuance">Emisi&oacute;n</a>');
```

---

### Paso 0.9 — Verificación automatizada de la Fase 0

Añade un bloque a `verify-nivel1.mjs` (o crea `verify-anchors.mjs`):

```ts
const { createCredential, findByCode } = await import("./src/services/credentials.service.ts");
const { issueCredential, getTransport } = await import("./src/services/anchoring.service.ts");
const { buildGraduationPayload } = await import("./src/services/payloads.service.ts");

const payload = await buildGraduationPayload(valentina.id, "prog-sistemas");
const cred = await createCredential({ type: "ACTA_GRADO", studentId: valentina.id, programId: "prog-sistemas", payload, issuedBy: "test" });
const res = await issueCredential(cred);
check("la credencial se ancla", res.ok === true);
check("el estado queda Anclado", findByCode(cred.code).status === "Anclado");

let report = await getTransport().verify(cred.code);
check("la verificación dice VERIFICADO", report.verified === true, report.status);

// Se altera el documento y la verificación debe detectarlo.
const { updateCredential } = await import("./src/services/credentials.service.ts");
updateCredential(cred.id, { payload: { ...payload, promedio: 5.0 } });
report = await getTransport().verify(cred.code);
check("una alteración se detecta", report.verified === false && report.status === "ALTERADO", report.status);
```

Este último test es **el corazón de la propuesta**: demuestra que el hash es real y que sirve para algo.

---

## 3. Fase 1 — El gateway institucional

### 3.1 Qué es

Un servicio Node/Express de ~400 líneas, en la carpeta `gateway/` del repositorio. Tres responsabilidades:

1. **Custodiar la llave** de firma institucional (fichero con permisos `0600`).
2. **Firmar y anclar** lo que el portal le pide.
3. **Responder las consultas públicas de verificación.**

### 3.2 Estructura

```
gateway/
  src/
    server.ts      Express: rutas y arranque
    signer.ts      Firma y verificación con Ed25519
    relay.ts       Cliente de la red (Hyperledger / Polygon)
    verifier.ts    Consulta de anclajes y validación de firma
    issuer.ts      Render del PDF (diploma, constancia, certificado)
    config.ts      Configuración por variables de entorno
  package.json
  Dockerfile
  .env.example
```

### 3.3 El firmante

```ts
// gateway/src/signer.ts
import { readFile } from "node:fs/promises";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

let privateKey: ReturnType<typeof createPrivateKey> | undefined;

export async function loadSigner(path: string): Promise<void> {
  const pem = await readFile(path, "utf8");
  privateKey = createPrivateKey(pem);
}

export function signHash(hash: string): string {
  if (!privateKey) throw new Error("El firmante no está inicializado.");
  return sign("sha256", Buffer.from(hash, "hex"), privateKey).toString("base64");
}

export function verifyHash(hash: string, signature: string, publicKeyPem: string): boolean {
  return verify("sha256", Buffer.from(hash, "hex"), publicKeyPem, Buffer.from(signature, "base64"));
}
```

Generación de la llave (una sola vez, **fuera** del repositorio):

```bash
openssl genpkey -algorithm ed25519 -out unac-signing-key.pem
chmod 600 unac-signing-key.pem
openssl pkey -in unac-signing-key.pem -pubout -out unac-signing-key.pub.pem
```

La clave **nunca** entra al repositorio ni al navegador. Se genera una vez en la máquina donde corre el gateway y se respalda fuera de ella.

### 3.4 Endpoints

| Método | Ruta | Acceso | Función |
|--------|------|--------|---------|
| `POST` | `/api/v1/anchors` | Staff autenticado | Firma el hash, lo ancla y devuelve `anchorId` |
| `GET` | `/api/v1/verify/:code` | Público | Reporte JSON de verificación |
| `GET` | `/verify/:code` | Público | Reporte HTML (lo que ve un humano) |
| `GET` | `/api/v1/credentials/:id.pdf` | Propietario o Staff | PDF firmado |
| `POST` | `/api/v1/revocations` | Staff | Revoca un anclaje |
| `GET` | `/health` | Público | Health check |

### 3.5 Autenticación del Staff

El gateway **no** confía en el `sessionStorage` del SPA. Opciones, de menor a mayor esfuerzo:

1. **Fase 1 (clase):** el gateway valida un token que él mismo emite contra un secreto compartido con el SPA. Aceptable en un entorno controlado, **no** en producción.
2. **Producción:** OAuth 2.0 con PKCE contra el IdP institucional, o un token de sesión de larga vida para Staff.

### 3.6 Cómo correr el gateway

El gateway es **un servicio aparte dentro del repositorio**, en la carpeta `gateway/`. En desarrollo corre en tu máquina; en producción, al lado del portal.

```bash
cd gateway
npm install
cp .env.example .env      # y pon aquí la URL de la red y la ruta de la llave
npm run dev               # http://localhost:3080
```

Variables de entorno (`.env`):

```bash
PORT=3080
NETWORK=polygon-edge      # hyperledger-fabric | polygon-edge
SIGNING_KEY_PATH=./unac-signing-key.pem
RELAY_URL=http://localhost:7051
CHAIN_FILE=./data/anchors.jsonl   # respaldo local de los anclajes
```

Y en el portal, para apuntar al gateway:

```ts
// src/services/anchoring.service.ts
const USE_GATEWAY = true;
const GATEWAY_URL = "http://localhost:3080";
```

Para que el portal (en `localhost:5173`) pueda llamar al gateway (en `localhost:3080`), el navegador pide un CORS. En el gateway:

```ts
app.use(cors({ origin: ["http://localhost:5173"], methods: ["GET", "POST"] }));
```

> **Sobre el despliegue en el servidor:** en producción el gateway se instala como un servicio más (systemd) detrás del mismo dominio, con Nginx enrutando `/api/` y `/verify/` a `127.0.0.1:3080`. No hace falta tocar Terraform ni el pipeline para eso: el portal y el gateway son dos procesos y una ruta más.

### 3.7 La red de pruebas

Opciones, en orden de dificultad:

| Opción | Dificultad | Nota |
|--------|------------|------|
| **Polygon Edge** | Baja | Red permissioned de Ethereum; se levanta rápido con un solo validador |
| **Hyperledger Fabric** | Media | Más fiel a la recomendación del documento; requiere ordenar una organización y un canal |
| Un smart contract en una testnet (Sepolia/Polygon Amoy) | Muy baja | Solo para probar la lógica del cliente; no cumple "red permisionada" |

Para el piloto de clase, **Polygon Edge en una sola organización** es lo más rápido de levantar y cumple la recomendación de red permisionada.

---

## 4. Fase 2 — El momento de la verdad

Cuando el gateway esté desplegado y probado, la migración es mínima:

```ts
// src/services/anchoring.service.ts
const USE_GATEWAY = true;                    // ← una línea
const GATEWAY_URL = "https://<public_dns>:3080";
```

Y el `LocalTransport` deja de usarse, pero **se queda en el repositorio**: es lo que permite seguir probando sin red (útil para CI y para las demos sin internet).

Verificaciones obligatorias antes de dar por buena la Fase 2:

- [ ] Emitir un acta desde el portal → el anclaje aparece en la red (explorador de bloques).
- [ ] Abrir la URL de verificación **desde otro navegador o desde un móvil** → dice VERIFICADO.
- [ ] Alterar una nota de un periodo ya anclado → la verificación dice ALTERADO.
- [ ] Revocar un acta → la verificación dice REVOCADO.
- [ ] El gateway no tiene la llave de firma expuesta en ningún HTML ni en el bundle del SPA.
- [ ] `grep -rEi 'nombre|apellido|documento|correo|telefono' gateway/data/anchors.jsonl` → **no encuentra nada**.

---

## 5. Resumen: el orden completo

```
FASE 0 (sin red, todo en el portal)
  0.1  Primitivas criptográficas        utils/crypto.ts
  0.2  Tipos y claves                   types.ts, data/keys.ts, seed.ts
  0.3  Servicio de credenciales         services/credentials.service.ts
  0.4  Transporte simulado              services/anchoring.service.ts
  0.5  Bitácora de auditoría            services/audit.service.ts
  0.6  Payloads desde funciones reales  services/payloads.service.ts
  0.7  Vistas                           views/issuance|credentials|verify.view.ts
  0.8  Rutas y navegación               router.ts, utils/dom.ts
  0.9  Verificación automatizada        verify-anchors.mjs

FASE 1 (con red)
  1.1  Firmante Ed25519                 gateway/src/signer.ts
  1.2  Relay a la red                   gateway/src/relay.ts
  1.3  Verificador                      gateway/src/verifier.ts
  1.4  API + autenticación del Staff    gateway/src/server.ts
  1.5  Correrlo en local                gateway/ (.env + npm run dev)

FASE 2
  2.1  Activar el transporte real       services/anchoring.service.ts (1 línea)
  2.2  Generación de PDF firmados       gateway/src/issuer.ts
  2.3  QR en el documento               gateway/src/issuer.ts
  2.4  Revocación operativa             gateway + panel Staff
  2.5  Migrar las credenciales a BD     (de localStorage a la base del SIS)
```

---

## 6. Los tres errores que más probablemente vas a cometer

1. **Meter datos personales en la cadena.** Es el error que rompe la propuesta ante un profesor de Habeas Data. Pon el test del `grep` en el pipeline desde el día uno, no al final.
2. **Confiar en el hash sin canonicalizar.** Si canonicalizas mal, el verificador recalcula un hash distinto y todo falla con "ALTERADO" sin explicación. Por eso `canonicalJson()` ordena las claves.
3. **Meter la llave en el frontend.** Ni en la Fase 0, ni "solo para probar". Si la llave se shippea en el bundle, el acta de grado del piloto queda sin valor y hay que rehacerlo.

---

*Guía elaborada sobre el estado real del portal Admisiones UNAC (esquema v7). Los nombres de fichero, funciones y rutas son verificables directamente en el repositorio.*
