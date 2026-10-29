---
title: "Propuesta de Implementación de Blockchain para el Portal de Admisiones y Matrícula UNAC"
subtitle: "Cómo aterrizar una arquitectura Blockchain sobre el sistema actual"
author: "Corporación Universitaria Adventista (UNAC)"
date: "25 de octubre de 2026"
lang: es-CO
keywords:
  - blockchain
  - admisiones
  - registro académico
  - credenciales verificables
  - trazabilidad
---

# Propuesta de Implementación de Blockchain para el Portal de Admisiones y Matrícula UNAC

**Proyecto:** Admisiones UNAC — Portal de admisiones y matrícula
**Documento base:** *Elementos clave para una solución Blockchain en Admisiones y Registro Académico* (Corporación Universitaria Adventista, UNAC)
**Versión:** 1.0 — sobre el *Portal Admisiones UNAC v0.2.0* (esquema de datos v7)
**Fecha:** 25 de octubre de 2026

---

## Contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Punto de partida: qué tiene hoy el portal](#2-punto-de-partida-qué-tiene-hoy-el-portal)
3. [Para qué serviría: casos de uso](#3-para-qué-serviría-casos-de-uso-atados-a-funciones-reales)
4. [Qué generaría: los artefactos concretos](#4-qué-generaría-los-artefactos-concretos)
5. [Arquitectura propuesta](#5-arquitectura-propuesta)
6. [Flujos de negocio, paso a paso](#6-flujos-de-negocio-paso-a-paso)
7. [Implementación por fases](#7-implementación-por-fases)
8. [Seguridad, privacidad y cumplimiento](#8-seguridad-privacidad-y-cumplimiento)
9. [Costos y sostenibilidad](#9-costos-y-sostenibilidad)
10. [Riesgos y mitigaciones](#10-riesgos-y-mitigaciones)
11. [Rúbrica: autoevaluación de esta propuesta](#11-rúbrica-autoevaluación-de-esta-propuesta)
12. [Cómo demostrarlo](#12-cómo-demostrarlo)
13. [Archivos que se crearían o modificarían](#13-archivos-que-se-crearían-o-modificarían)
14. [Conclusiones](#14-conclusiones)
- [Anexo A — Glosario](#anexo-a--glosario)
- [Anexo B — Referencias del documento base](#anexo-b--referencias-del-documento-base)

---

## 1. Resumen ejecutivo

El documento institucional original define **el qué**: una arquitectura Blockchain para la verificación, expedición y trazabilidad de títulos, diplomas, certificados académicos y trámites de admisión de la UNAC, con red permisionada, consenso Proof of Authority, datos personales sensibles fuera de la cadena (solo hashes) e identidad auto-soberana con estándares W3C Verifiable Credentials.

Este documento define **el cómo**: cómo aterrizar esa visión sobre el portal que ya existe, sin reescribirlo, respetando su arquitectura por capas (`types → data → services → views → router`) y su philosophy de simplicidad. La propuesta no es "añadir blockchain al portal": es **convertir los tres documentos que hoy el portal genera y pierde en el `localStorage` del navegador —actas de grado, constancias de matrícula y certificados de materias cursadas— en credenciales verificables** que sobrevivan a que el estudiante borre sus datos, a que cambie de institución y a que un empleador quiera verificar sin llamar a la UNAC.

La tesis central es simple y auditable:

> **El portal ya tiene el 80% del dato que necesita una credencial verificable: sabe qué materia se cursó, con qué nota, en qué periodo, bajo qué programa y con qué peso. Lo que le falta es (a) una firma institucional, (b) una prueba de que ese registro no cambió y (c) una forma de verificarlo fuera del sistema. Eso es exactamente lo que aporta un ancla criptográfica en una cadena de bloques.**

El portal funciona hoy con 100 estudiantes de prueba, 13 servicios, 20 vistas, un pipeline CI/CD "All Green" en GitLab, infraestructura Terraform sobre AWS (`us-east-2`) y una automatización n8n que notifica al Staff por Telegram. La propuesta se apoya en todo eso: el **gateway blockchain** se despliega como un servicio nuevo sobre la misma EC2 que ya existe, el pipeline gana una etapa, y el SPA actual se convierte en el cliente *off-chain* que firma y consulta.

### 1.1 Qué se propone en concreto

| # | Capacidad | Función actual que se reutiliza | Artefacto que genera |
|---|-----------|-------------------------------|------------------------|
| 1 | **Acta de grado ancla** | `grades.service.ts` → `graduationProgress()` | Acta de grado en PDF + hash en cadena + QR de verificación |
| 2 | **Certificado de materias** | `grades.service.ts` → `listGradedCourses()` | Certificado de notas por semestre con ancla por periodo |
| 3 | **Constancia de matrícula** | `enrollment.service.ts` → `getActiveEnrollments()` | Constancia con código de verificación único |
| 4 | **Homologación verificable** | `prerequisites.service.ts` → `updatePrerequisiteStatus()` | Certificado de equivalencia por materia cursada fuera |
| 5 | **Trazabilidad de decisiones** | `admissions.service.ts` → `decide()` | Acta de admisión con historial de estados |

### 1.2 Lo que NO se propone

- **No se propone reescribir el portal.** El SPA sigue siendo el sistema de registro; blockchain es una capa de *sellado y verificación*, no un reemplazo.
- **No se propone guardar datos personales en la cadena.** Todo dato personal y todo documento permanece *off-chain*. A la cadena solo va un hash SHA-256, un identificador, una marca de tiempo y una firma.
- **No se propone una moneda ni un token.** No hay valor económico en la red; hay evidencia criptográfica.
- **No se propone blockchain público.** La red es permisionada y federada, tal como recomienda el documento original.

---

## 2. Punto de partida: qué tiene hoy el portal

Antes de proponer, conviene fijar con precisión sobre qué se construye. Este es el inventario real del código, no una descripción aspiracional.

### 2.1 Arquitectura actual

```
src/
  types.ts                  26 modelos de dominio (Account, Course, Enrollment, Assignment…)
  data/
    keys.ts                 21 claves de localStorage
    store.ts                Lectura/escritura de colecciones + caché por clave
    seed.ts                 Sembrado: 10 programas, 100 estudiantes, tareas y notas
  utils/
    crypto.ts               hashPassword (SHA-256 + sal), randomSalt, randomToken
    dom.ts                  Shell, navegación, badges de estado
    validators.ts           Reglas de validación
    curriculum.ts           Render del pensum
  services/                 13 servicios de lógica de negocio
  views/                    20 vistas (una por pantalla)
  router.ts                 Enrutado por hash con protección por rol
  style.css                 Sistema visual
```

**Punto clave:** el portal es 100 % front-end. No hay backend. Los datos viven en `localStorage` del navegador. Esto es la restricción central que condiciona *toda* la propuesta blockchain, y por eso el documento dedica la sección 5 a resolverla en vez de evadirla.

### 2.2 Servicios existentes (el "off-chain" que ya existe)

| Servicio | Responsabilidad | Dato que produce y que hoy se pierde al borrar el navegador |
|----------|-----------------|---------------------------------------------------------------|
| `auth.service.ts` | Registro, login, sesión, recuperación | `Account` con `passwordHash` + `passwordSalt` |
| `admissions.service.ts` | Ciclo de vida de la solicitud | `AdmissionApplication` con estados y `reviewNote` |
| `catalog.service.ts` | Programas, materias, periodos, ofertas | `Program`, `Course`, `CourseOffering`, `Period` |
| `enrollment.service.ts` | Reglas de matrícula, prerrequisitos, lista de espera | `Enrollment`, `WaitlistEntry` |
| `grades.service.ts` | Notas, promedio ponderado, avance al grado | `Enrollment.grade` |
| `assignments.service.ts` | Tareas con % de peso y notas por estudiante | `Assignment`, `AssignmentGrade` |
| `prerequisites.service.ts` | Homologaciones de materias cursadas afuera | `ExternalPrerequisite` con `status: Aprobada` |
| `program-changes.service.ts` | Cambios de carrera | `ProgramChangeRequest` |
| `notifications.service.ts` | Avisos del ciclo de vida | `Notification` |
| `waitlist.service.ts` | Lista de espera por oferta | `WaitlistEntry` |
| `preferences.service.ts` | Tema claro/oscuro | `ThemePreferences` |

### 2.3 Funciones de verificación ya existentes (el punto de anclaje)

Estas cuatro funciones son, sin embargo, el corazón del proyecto y son las que hoy **no dejan rastro verificable**:

1. **`grades.service.ts` → `graduationProgress(studentId, programId)`**
   Calcula `totalCredits`, `earnedCredits`, `percent`, `average`, `pendingRequired` y `canGraduate`. Ya sabe si un estudiante puede graduarse. Ese veredicto es exactamente el contenido de un acta de grado.

2. **`grades.service.ts` → `listGradedCourses(studentId)`**
   Devuelve cada materia cursada con su nota, su periodo, sus créditos y si fue aprobada. Es el contenido de un certificado de notas.

3. **`assignments.service.ts` → `recalculateFinalGrade(offeringId, studentId)`**
   Calcula la nota final como promedio ponderado de tareas y la oficializa cuando se cubre el 100 % del peso. Es la prueba de que una nota no fue alterada después de emitirse.

4. **`enrollment.service.ts` → `evaluateEnrollment(studentId, offeringId)`**
   Valida prerrequisitos, límite de créditos, choques de horario, cupos y duplicidad. Es la política de matrícula que debería quedar registrada como parte del acta.

**Lo que falta en las cuatro:** que su resultado esté firmado por la institución y que un tercero pueda verificarlo sin acceso al sistema.

### 2.4 Infraestructura disponible para alojar la solución

| Componente | Estado actual | Uso propuesto |
|------------|----------------|---------------|
| AWS `us-east-2` (cuenta `908130151595`) | EC2 con AMI propia (Ubuntu 24.04 + Nginx + Docker + Node) | Alojar el **gateway blockchain** como servicio Node en la misma instancia |
| Terraform (`terraform/main.tf`) | S3 público + bucket policy + SG + EC2 con `user_data.sh` | Nuevo recurso para el servicio del gateway + variables de configuración de la red |
| GitLab CI/CD | 6 etapas: `build → validate → plan → apply → smoke → destroy` | Nueva etapa `anchor` que despliega y prueba el gateway |
| n8n (n8n.cloud) | Webhook `nuevo-aspirante` → Telegram → Staff | Nuevo webhook `nuevo-titulado` que notifica al egresado cuando se ancla su acta |
| Bucket S3 | Bucket público donde vive `dist/` | Bucket **privado** para documentos firmados (las credenciales no son públicas) |
| `ci/smoke.sh` | Smoke test POSIX `sh` contra `$APP_URL` | Smoke test del endpoint de verificación |

### 2.5 Restricciones y deuda técnica que la propuesta debe respetar

| Restricción | Implicación para blockchain |
|-------------|----------------------------|
| Sin backend: todo en `localStorage` | La escritura en cadena **no puede** hacerse desde el navegador. Se necesita un servicio intermediario. |
| IAM sin `iam:PutRolePolicy` | El gateway no puede Assuming un rol de servicio con políticas propias; deberá usar credenciales del mismo patrón que ya usa el pipeline (`AWS_ACCESS_KEY_ID` masked en CI) o access keys de instancia. |
| Bucket S3 público | Los documentos firmados **no** pueden vivir ahí. Requiere un bucket privado, y eso es una decisión de Terraform nueva. |
| Contraseñas con SHA-256 + sal propia | LaInstitution **ya tiene** primitives criptográficos (`utils/crypto.ts`). Reutilizarlos baja la curva de adopción y evita meter una librería nueva. |
| Sin tests automatizados en CI | Un anclaje mal formado no se detectaría. La fase 1 debe incluir pruebas antes de tocar la red real. |

---


ewpage

## 3. Para qué serviría: casos de uso atados a funciones reales

Cada caso de uso se enuncia con la función existente que lo alimenta, el problema concreto que resuelve y el criterio de aceptación.

### 3.1 Caso A — Acta de grado verificable

**Problema actual.** `graduationProgress()` responde "¿puede graduarse?" dentro del navegador del estudiante. Si borra los datos del sitio, el veredicto desaparece. Si un empleador pide "¿este título es auténtico?", la UNAC no tiene forma de responder sin buscar un registro físico.

**Función que lo alimenta.** `grades.service.ts` → `graduationProgress()` + `listGradedCourses()`.

**Qué hace blockchain.** Al alcanzar el 100 % del pensum, el Staff emite el acta: el sistema calcula el *payload* canónico (programa, estudiante, plan de estudios, promedio ponderado y fecha), lo hashea con SHA-256 y escribe el hash en la cadena junto con la firma de la llave institucional. El acta en PDF (generado en el servidor, no en el navegador) lleva el hash y un QR.

**Criterio de aceptación.** Un tercero abre la URL de verificación, ve "Acta de grado emitida por la UNAC, folio `UNAC-2026-000145`, plan `prog-sistemas`, fecha `2026-10-25`" y un sello verde de autenticidad, sin necesidad de cuenta ni de llamar a la universidad.

### 3.2 Caso B — Certificado de materias cursadas

**Problema actual.** `listGradedCourses()` devuelve el historial, pero solo existe mientras el navegador lo conserve. Un certificado de notas es, en la práctica, el documento que un estudiante necesita para traslados y para gestionar su historia académica.

**Función que lo alimenta.** `grades.service.ts` → `listGradedCourses()` y `grades.service.ts` → `gradeAverage()`.

**Qué hace blockchain.** Al cerrar cada periodo académico, se ancla un *hash de periodo* que resume todas las notas del estudiante en ese periodo (un solo ancla por estudiante por periodo, no uno por materia: la granularidad fina no aporta y encarece). El certificado incluye el desglose de tareas con su porcentaje — que ya existe en `assignments.service.ts` — para que sea auditable cómo se llegó a la nota final.

**Criterio de aceptación.** El certificado muestra el detalle: `Parcial 1 (30%) 4.2 · Parcial 2 (30%) 3.8 · Trabajo práctico (40%) 4.5 → Nota final 4.19`. Cualquier modificación de una tarea después de emitida invalida el hash y la verificación lo señala.

### 3.3 Caso C — Constancia de matrícula verificable

**Problema actual.** `getActiveEnrollments()` responde "¿en qué materias está matriculado este estudiante en este periodo?". Es la consulta que hacen empleadores ("¿el estudiante X está matriculado en esta universidad?") y que hoy solo el Staff puede responder.

**Función que lo alimenta.** `enrollment.service.ts` → `getActiveEnrollments()` + `creditsInUse()`.

**Qué hace blockchain.** Al matricularse, se emite una constancia con un código corto (por ejemplo `UNAC-MAT-7F3K2D`) que indexa un anclaje. La consultante —un empleador, un coordinador académico— escribe el código en la URL pública de verificación y obtiene el estado, el programa y las materias del periodo, sin ver datos que no sean los mínimos.

**Criterio de aceptación.** La verificación muestra solo lo estrictamente necesario: estado de la matrícula, programa, periodo y listado de materias. Nada de notas, dirección ni documentos.

### 3.4 Caso D — Homologación de materias cursadas en otras instituciones

**Problema actual.** `prerequisites.service.ts` registra una `ExternalPrerequisite` con `courseCode`, `courseName`, `institution`, `year` y `grade`, y el Staff la aprueba o rechaza. Una vez aprobada, **esa homologación es el único respaldo de que el estudiante cursó un conocimiento externo**, y no tiene firma ni trazabilidad.

**Función que lo alimenta.** `prerequisites.service.ts` → `updatePrerequisiteStatus(id, "Aprobada")`.

**Qué hace blockchain.** Al aprobar una homologación se ancla un hash del registro (código de la materia, institución, año, nota, decisión y sello del Staff que decidió). Si un día se cuestiona una homologación, el ancla demuestra que la decisión institucional existió, cuándo se tomó y sobre qué base.

**Criterio de aceptación.** La historia de homologaciones de un estudiante es un listado de anclas verificables, y cada una conserva la firma del decisor.

### 3.5 Caso E — Trazabilidad del proceso de admisión

**Problema actual.** `admissions.service.ts` mueve la solicitud por `Radicada → En revisión → Admitido / Rechazado`, con `reviewedAt` y `reviewNote`. Es un proceso con decisiones humanas que hoy no deja registro verificable. El documento original menciona explícitamente la "trazabilidad de trámites de admisión" como alcance.

**Función que lo alimenta.** `admissions.service.ts` → `markUnderReview()` y `decide()`.

**Qué hace blockchain.** Cada transición de estado genera un ancla con la hora, el actor (Staff), la decisión y el motivo. El resultado es una **bitácora auditable** del proceso, que es justo lo que pide la sección de reglas de "Indicadores de gestión".

**Criterio de aceptación.** El panel de Staff puede mostrar, por solicitud, la cadena completa de decisiones con su ancla. Un proceso cuestionado se puede reconstruir sin depender de la base de datos.

### 3.6 Caso F (opcional, fase 2) — Microcredenciales de competencia

**Problema actual.** No existe. Es la extensión natural hacia "auto-soberanía del estudiante" del documento original.

**Función que lo alimenta.** `assignments.service.ts` (las tareas ya son unidades evaluables) + `grades.service.ts`.

**Qué hace blockchain.** Al aprobar una tarea con peso suficiente (por ejemplo, el Trabajo Práctico de una Práctica), se emite una microcredencial W3C Verifiable Credentials con el estándar Blockcerts, controbable en una billetera digital por el propio estudiante.

**Criterio de aceptación.** El estudiante puede exportar su credencial a una billetera y presentarla sin que la UNAC sea un intermediario.

---

## 4. Qué generaría: los artefactos concretos

Esta sección responde la pregunta literal del encargo: qué se produce con la solución.

### 4.1 Artefactos por usuario

| Actor | Artefacto | Formato | Quién lo emite | Dónde vive |
|--------|-----------|---------|----------------|-------------|
| Estudiante que se gradúa | **Acta de grado** | PDF + JSON firmado | Staff (`#admin`) | S3 privado + hash en cadena |
| Estudiante | **Certificado de notas por periodo** | PDF | Automático al cerrar periodo | S3 privado + hash en cadena |
| Estudiante | **Constancia de matrícula** | PDF con código | Automático al matricular | S3 privado + hash en cadena |
| Estudiante | **Certificado de homologación** | PDF | Staff (`#admin`) | S3 privado + hash en cadena |
| Estudiante | **Microcredencial** | JSON VC / Blockcerts | Automático | Wallet del estudiante |
| Employador / tercero | **Reporte de verificación** | JSON + HTML público | Público | Endpoint público |
| Staff | **Bitácora de decisiones** | JSON | Automático | S3 privado + hashes en cadena |
| UNAC | **Auditoría de la red** | Export JSONL | Gateway | S3 privado |

### 4.2 Anatomía de un anclaje (el bloque que va a la cadena)

Cada anclaje es un registro pequeño y **sin datos personales**. Este es el formato propuesto:

```json
{
  "tipo": "ACTA_GRADO",
  "referencia": "UNAC-2026-000145",
  "codigo": "7F3K2D",
  "hashPayload": "b3a91f...c7e4",
  "emisor": "unac.edu.co",
  "periodo": "2026-2",
  "programa": "prog-sistemas",
  "selloTiempo": "2026-10-25T14:32:11Z",
  "firma": "MEUCIQD...",
  "version": 1
}
```

**Lo que deliberadamente NO está:** nombre, documento de identidad, correo, teléfono, notas individuales, dirección. Todo eso vive *off-chain* y se referencia por un identificador opaco (`referencia`).

**Lo que sí está:** el hash del payload que contiene los datos personales, una referencia opaca, el emisor, la fecha y la firma. Eso es suficiente para probar integridad y es todo lo que la Ley 1581 de 2012 permite persistir públicamente.

### 4.3 URL de verificación (el producto visible)

```
https://verificar.unac.edu.co/7F3K2D
```

La respuesta debe ser legible por una persona, no por un máquina:

```
✔ VERIFICADO — Acta de grado
Corporación Universitaria Adventista (UNAC)
Folio:        UNAC-2026-000145
Programa:     Ingeniería de Sistemas
Plan:         prog-sistemas · versión 2026
Fecha:        25 de octubre de 2026
Hash:         b3a91f...c7e4
Ancla:        #1 284 517 903

✔ La firma institucional es válida y el registro no ha sido alterado.
```

Y su equivalente JSON para verificación programática:

```json
{
  "verificado": true,
  "tipo": "ACTA_GRADO",
  "referencia": "UNAC-2026-000145",
  "emisor": "unac.edu.co",
  "selloTiempo": "2026-10-25T14:32:11Z",
  "hashPayload": "b3a91f...c7e4"
}
```

### 4.4 Qué NO generaría

- **No generaría datos personales en la cadena.** Ni nombres, ni notas, ni documentos.
- **No generaría blockchain público.** La red es permisionada.
- **No generaría un sistema transaccional.** No hay pagos, no hay matrículas de dinero, no haysmart contracts detrueSwap.
- **No reemplazaría el SIS.** Sigue siendo la fuente de verdad; la cadena solo sella sus resultados.

---


ewpage

## 5. Arquitectura propuesta

### 5.1 La restricción que hay que resolver primero

El portal no tiene backend. **Un navegador no puede escribir en una cadena de bloques de forma confiable**: no tiene llave institucional, no puede custodiar la firma, y expondría la llave si se distribuyera al cliente. Cualquier propuesta que diga "el SPA escribe el hash directo a la red" es **incorrecta** desde el punto de vista de seguridad.

Por eso la arquitectura tiene **tres capas**, no dos:

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — OFF-CHAIN: el portal (SPA)                            │
│  Sigue siendo el sistema de registro. localStorage → BD real.   │
│  Calcula el payload, lo hashea, y PIDE la firma.                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (REST)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — GATEWAY: servicio institucional                      │
│  Corre en la EC2 que ya existe.                                │
│  • Custodia la llave institucional (archivo, permiso 0600)      │
│  • FIRMANTE — valida la sesión del Staff, firma el payload      │
│  • RELAY — escribe el anclaje en la red                         │
│  • VERIFICADOR — responde consultas públicas de verificación     │
│  • EMISOR — renderiza PDF y los guarda en S3 privado             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / WS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — CADENA: red permisionada federada                     │
│  Hyperledger Fabric / Polygon Edge / Ethereum PoA              │
│  Solo hashes, referencias, sellos de tiempo y firmas.          │
└─────────────────────────────────────────────────────────────────┘
```

**El gateway es la pieza nueva.** Es un servicio Node/Express pequeño que se despliega en la misma instancia EC2 que ya sirve el portal, y que se integra en el pipeline existente como una etapa más.

### 5.2 Elección de red

Siguiendo la recomendación del documento original (§2.2), se propone una **red permisionada federada**. Orden de preferencia:

| Opción | Ventajas | Inconvenientes | Recomendación |
|--------|----------|----------------|----------------|
| **Hyperledger Fabric** | Sin gas, permisos finos por canal, alineado con ANSI/BSN, separa identidad de transaccionador | Infraestructura más pesada; la cadena de la UNAC debe ser operada | ✅ **Preferida** para producción institucional |
| **Polygon Edge / POS** | Compatible con Ethereum (contratos inteligentes disponibles), menor esfuerzo ops | Modelo de permisos menos fino que Fabric | Alternativa razonable si se quiere mantener compatibilidad con herramientas del ecosistema Ethereum |
| **Ethereum PoA /matic** | Herramientas del ecosistema más maduras, BBC | Coste y complejidad de operación de un validador PoA | Solo para pruebas |

**Consenso:** Proof of Authority con un conjunto reducido de validadores (UNAC +, opcionalmente, otras instituciones de la Red Educativa Adventista). La clave de cada validador está en un HSM o, en la fase 1, en un keystore cifrado del gateway con permiso `0600`.

**Justificación económica:** el número de transacciones anuales de la UNAC es de **órdenes de magnitud inferior** a las de una red pública. En una red PoA el costo marginal por transacción es prácticamente cero, lo que satisface el criterio 5 de la rúbrica ("modelo de costos claro, escalable, bajo costo de mantenimiento").

### 5.3 Identidad auto-soberana (SSI)

El documento original (§2.5) pide W3C Verifiable Credentials. Esto **no es un extra**: es la pieza que convierte "un PDF con un QR" en "una credencial que el estudiante posee".

Implementación propuesta, en orden de madurez:

1. **Fase 1 — Credencial firmada por la institución, verificable por terceros.** El estudiante recibe un JSON firmado (JWT VC o un VC JSON-LD) que puede guardar y compartir. Quien lo verifica usa la clave pública de la UNAC, publicada. No requiere billetera.
2. **Fase 2 — Microcredenciales con Blockcerts.** Formato estándar internacional, interoperable con cualquier billetera.
3. **Fase 3 — Credenciales ligadas a DID.** Identidad auto-soberana plena, con `did:web` de la UNAC como emisor.

### 5.4 Modelo de datos: qué se añade al portal

El portal ya tiene `types.ts` como contrato de datos. Las adiciones son **mínimas y aditivas**, y siguen el patrón existente (`interface` + `storage key` + `service`):

```ts
// ── src/types.ts (adiciones) ───────────────────────────────────────

/** Tipo de credencial que la UNAC ancla en la red. */
export type CredentialType =
  | "ACTA_GRADO"
  | "CERTIFICADO_NOTAS"
  | "CONSTANCIA_MATRICULA"
  | "HOMOLOGACION"
  | "ACTA_ADMISION"
  | "MICROCREDENCIAL";

export type AnchorStatus = "Pendiente" | "Anclado" | "Fallido" | "Revocado";

/** Registro local de una credencial: el hash, su estado y su referencia. */
export interface Credential {
  id: string;
  type: CredentialType;
  /** Código corto que el estudiante comparte (ej. 7F3K2D). */
  code: string;
  /** Folio institucional legible (ej. UNAC-2026-000145). */
  reference: string;
  /** Dueño de la credencial (null para documentos institucionales). */
  studentId?: string;
  programId?: string;
  periodId?: string;
  /** Hash SHA-256 del payload canonicalizado. */
  payloadHash: string;
  /** Payload off-chain (contenido real del documento). */
  payload: Record<string, unknown>;
  status: AnchorStatus;
  /** Tx hash / id de bloque devuelto por la red. */
  anchorId?: string;
  /** Error si el anclaje falló. */
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

**Y dos claves de almacenamiento nuevas**, siguiendo el patrón de `data/keys.ts`:

```ts
export const STORAGE_KEYS = {
  // …las existentes…
  credentials: "unac-credentials",
  anchorAudit: "unac-anchor-audit",
} as const;
```

> **Nota de diseño importante.** Estos registros viven en `localStorage` **solo en la fase 0 (simulación)**. En producción, `Credential` y `AnchorAudit` son tablas de la base de datos del SIS, y `payload` (que contiene datos personales) se guarda cifrado en el bucket privado. La estructura de `types.ts` no cambia: cambia dónde se persiste. Esta separación es deliberada para que el portal no tenga que reescribirse al añadir el backend.

### 5.5 Servicios nuevos (ficheros concretos)

Se respeta el patrón existente: **un servicio = una responsabilidad = un fichero**, con funciones puras que no dependen del DOM.

| Fichero nuevo | Responsabilidad | Funciones principales |
|---------------|-----------------|-----------------------|
| `src/services/credentials.service.ts` | Ciclo de vida de la credencial *off-chain* | `createCredential()`, `listCredentialsFor()`, `listByCode()`, `serializePayload()`, `canonicalizePayload()` |
| `src/services/anchoring.service.ts` | Puente con el gateway (cliente HTTP) | `requestAnchor()`, `getAnchorStatus()`, `verifyAnchor()`, `buildVerificationUrl()` |
| `src/services/audit.service.ts` | Bitácora de acciones de anclaje | `recordAudit()`, `listAuditFor()` |

Y **modificaciones puntuales** a servicios existentes, todas en la misma línea de estilo:

| Servicio existente | Cambio | Tamaño |
|--------------------|--------|--------|
| `grades.service.ts` | Añadir `buildGraduationPayload()` — arma el payload canónico del acta usando `graduationProgress()` | ~40 líneas |
| `grades.service.ts` | Añadir `buildTranscriptPayload()` — payload de notas por periodo | ~30 líneas |
| `enrollment.service.ts` | Añadir `buildEnrollmentProof()` — payload de constancia de matrícula | ~25 líneas |
| `admissions.service.ts` | `decide()` notifica al gateway del anclaje de decisión | ~10 líneas |
| `prerequisites.service.ts` | `updatePrerequisiteStatus()` notifica el anclaje de homologación | ~10 líneas |
| `utils/crypto.ts` | Añadir `sha256Hex(text)` (hash de payload, sin sal) y `canonicalJson(obj)` | ~25 líneas |

**Reutilización de primitivas existentes.** `utils/crypto.ts` ya tiene `hashPassword` (SHA-256 + sal), `randomSalt` y `randomToken`. El hash del payload **no** lleva sal —tiene que ser reproducible para que un tercero pueda recalcularlo— pero la primitiva (`crypto.subtle.digest`) es la misma. No se introduce ninguna dependencia criptográfica nueva.

### 5.6 Mapa función actual → función con blockchain

| Función actual | Qué hace hoy | Qué añade blockchain | Servicio/archivo |
|----------------|---------------|----------------------|------------------|
| `graduationProgress()` | Calcula si el estudiante puede graduarse | Emite el acta y la ancla | `grades.service.ts` + `credentials.service.ts` |
| `listGradedCourses()` | Lista materias con nota | Emite el certificado de notas del periodo | `grades.service.ts` |
| `getActiveEnrollments()` | Lista materias matriculadas | Emite la constancia de matrícula | `enrollment.service.ts` |
| `decide()` | Admite o rechaza una solicitud | Ancla la decisión con actor y motivo | `admissions.service.ts` |
| `updatePrerequisiteStatus()` | Aprueba o rechaza una homologación | Ancla la homologación | `prerequisites.service.ts` |
| `recalculateFinalGrade()` | Recalcula la nota final ponderada | El hash del certificado detectaría cualquier alteración posterior | `assignments.service.ts` |
| `evaluateEnrollment()` | Valida la matrícula | Sus reglas quedan como parte del acta (auditoría de la política) | `enrollment.service.ts` |
| `listActiveNotificationsFor()` | Muestra avisos | Nuevo aviso: "Tu acta fue emitida y anclada" | `notifications.service.ts` |

### 5.7 Vistas nuevas

| Vista | Ruta | Quién la usa | Qué hace |
|-------|------|--------------|----------|
| `credentials.view.ts` | `#credentials` | Estudiante | Sus credenciales emitidas, con QR y botón de descarga |
| `verify.view.ts` | `#verify` (público) | Cualquiera | Verificación por código, sin sesión |
| `issuance.view.ts` | `#issuance` | Staff | Emisión de actas y certificados desde `#admin` |

Y un enlace nuevo en `utils/dom.ts` → `buildNav()`:

```ts
if (account.role === "Estudiante") links.push('<a href="#credentials">Mis credenciales</a>');
if (account.role === "Staff") links.push('<a href="#issuance">Emisi&oacute;n</a>');
```

### 5.8 El gateway: qué es y dónde vive

Un servicio Node (Express) de **~400 líneas**, sin base de datos propia (usa la MISMA base de datos que el SIS en producción; en fase 1 usa SQLite en el disco de la EC2).

```
gateway/
  src/
    server.ts          Express: rutas públicas y privadas
    signer.ts          Firma y verificación de payloads (llave institucional)
    relay.ts           Cliente de la red (Hyperledger / Polygon)
    issuer.ts          Render de PDF (plantillas diploma/constancia/certificado)
    verifier.ts        Consulta de anclajes y validación de firma
    config.ts          Configuración por variables de entorno
  Dockerfile
  .env.example
```

**Endpoints:**

| Método | Ruta | Acceso | Función |
|--------|------|--------|---------|
| `POST` | `/api/v1/anchors` | Staff autenticado | Firma un payload y lo ancla. Devuelve `anchorId`, `hash` y `code` |
| `GET` | `/api/v1/anchors/:code` | Público | Consulta el estado de un anclaje |
| `GET` | `/verify/:code` | Público | Reporte de verificación en HTML |
| `GET` | `/api/v1/verify/:code` | Público | Reporte de verificación en JSON |
| `GET` | `/api/v1/credentials/:id.pdf` | Estudiante / Staff | Descarga del PDF firmado |
| `GET` | `/health` | Público | Health check (el CI lo usa) |
| `POST` | `/api/v1/revocations` | Staff | Revoca un anclaje (p. ej. error de transcripción) |

**Autenticación.** El gateway **no** confía en el `sessionStorage` del SPA. El SPA obtiene un token corto del gateway mediante un flujo de tipo *client credentials* con la llave institucional del servidor… salvo que el navegador no puede custodiar esa llave. La solución correcta para una SPA es un flujo **OAuth 2.0 Authorization Code con PKCE** contra el IdP institucional, o, más simple y suficiente para la fase 1, un token de sesión de larga vida **solo para Staff** emitido por el gateway y almacenado en `sessionStorage` del navegador (aceptable en fase 1 porque el navegador es el mismo entorno controlado; a escala se migra a OIDC).

### 5.9 Integración con la infraestructura existente

**Terraform** (`terraform/main.tf`) — recursos nuevos:

```hcl
# Bucket privado para los documentos firmados (NO público, a diferencia del
# bucket del sitio estático).
resource "aws_s3_bucket" "credentials" {
  bucket        = "${var.project_name}-credentials-${data.aws_caller_identity.current.account_id}"
  force_destroy = var.app_bucket_force_destroy
}

resource "aws_s3_bucket_public_access_block" "credentials" {
  bucket = aws_s3_bucket.credentials.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# El gateway corre como servicio en la misma EC2 (systemd), no como
# instancia nueva: el piloto no justifica un segundo nodo.
resource "aws_s3_bucket_object" "gateway_env" { … }  # plantilla de configuración
```

Además, una **variable nueva** `blockchain_network` y `blockchain_gateway_port`, y outputs `gateway_url` y `credentials_bucket`.

**`user_data.sh`** — se le añade el arranque del gateway:

```bash
# …después de sincronizar el sitio y reiniciar Nginx…
log "Arrancando el gateway blockchain…"
install -m 0600 /var/www/html/gateway.env /etc/unac-gateway.env
systemctl enable --now unac-gateway
```

**GitLab CI/CD** — una etapa nueva entre `apply` y `smoke`:

```yaml
stages:
  - build
  - validate
  - plan
  - apply
  - anchor      # ← NUEVA
  - smoke
  - destroy

gateway-deploy:
  stage: anchor
  image: node:20-alpine
  needs: ["terraform-apply"]
  script:
    - npm ci --prefix gateway
    - npm run build --prefix gateway
    - scp -r gateway/dist ec2:$GATEWAY_PATH
    - ssh ec2 "systemctl restart unac-gateway"
  rules:
    - if: $CI_COMMIT_BRANCH
```

Y el **smoke test** se amplía para comprobar que el gateway responde:

```sh
# en ci/smoke.sh, después de la comprobación del sitio
curl -fsSL "$GATEWAY_URL/health" | grep -q '"ok":true' || {
  echo "ERROR: el gateway blockchain no responde correctamente."
  exit 1
}
```

**n8n** — un workflow nuevo, simétrico al existente:

```
Webhook "nuevo-titulado" → Telegram "Notificar Egresado" → Respond OK
```

que avisa al egresado cuando su acta queda anclada.

---

## 6. Flujos de negocio, paso a paso

### 6.1 Flujo 1 — Emisión del acta de grado

```
 Staff (web)                Portal (SPA)              Gateway                 Red
     │                          │                       │                     │
     │ 1. "#issuance": elige    │                       │                     │
     │    estudiante y programa │                       │                     │
     ├─────────────────────────>│                       │                     │
     │                          │ 2. buildGraduation    │                     │
     │                          │    Payload()           │                     │
     │                          │    + canonicalJson()  │                     │
     │                          │    + sha256Hex()      │                     │
     │                          │                       │                     │
     │                          │ 3. POST /api/v1/     │                     │
     │                          │    anchors {payload, │                     │
     │                          │    hash, tipo}        │                     │
     │                          ├──────────────────────>│                     │
     │                          │                       │ 4. valida sesión    │
     │                          │                       │    Staff + permisos │
     │                          │                       │                     │
     │                          │                       │ 5. firma con la    │
     │                          │                       │    llave instituc.  │
     │                          │                       │    (Ed25519)        │
     │                          │                       │                     │
     │                          │                       │ 6. relay: escribe  │
     │                          │                       ├────────────────────>│
     │                          │                       │                     │
     │                          │                       │ 7. anchorId        │
     │                          │                       │<────────────────────┤
     │                          │<──────────────────────┤                     │
     │                          │ 8. guarda Credential │                     │
     │                          │    en localStorage    │                     │
     │                          │    + notifica "tu     │                     │
     │                          │    acta fue anclada"  │                     │
     │ 9. ve el QR y el PDF    │                       │                     │
     │<─────────────────────────┤                       │                     │
```

**Decisión de diseño clave:** el payload (con datos personales) **nunca sale del navegador hacia la red**. El navegador hashea; el gateway firma lo que el navegador le entrega; la red solo ve el hash.

**Detalle criptográfico.** Para que un tercero pueda verificar, la cadena debe contener el hash del payload **y** la firma sobre ese hash. Esquema:

```
hashPayload = SHA256(canonicalJson(payload))
firma       = Ed25519(firmar(llaveInstitucional, hashPayload))
```

El verificador recalcula `SHA256(canonicalJson(payload))` a partir del documento entregado y compara con el `hashPayload` de la cadena; luego valida la firma con la clave pública publicada. Si alguien altera una nota y regenera el PDF, el hash cambia y la verificación falla.

### 6.2 Flujo 2 — Verificación por un tercero (sin cuenta)

```
   Empleador                        Gateway                      Red
       │                                │                           │
       │ 1. abre /verify/7F3K2D        │                           │
       ├───────────────────────────────>│                           │
       │                                │ 2. consulta el anclaje   │
       │                                ├──────────────────────────>│
       │                                │                           │
       │                                │ 3. recibe hash + firma   │
       │                                │<──────────────────────────┤
       │                                │                           │
       │                                │ 4. valida la firma con   │
       │                                │    la clave pública      │
       │                                │    publicada             │
       │ 5. "✔ VERIFICADO"              │                           │
       │<───────────────────────────────┤                           │
```

### 6.3 Flujo 3 — Nota alterada después de emitida (detección)

```
   Staff corrige una nota           Gateway                  Red
          │                             │                      │
          │ 1. recalculateFinalGrade()  │                      │
          │    → cambia Enrollment.grade │                      │
          │                             │                      │
          │ 2. POST /anchors (nuevo hash)│                      │
          ├────────────────────────────>│ 3. nuevo anclaje      │
          │                             ├─────────────────────>│
          │                             │                      │
          └─ El anclaje ANTERIOR sigue en la red con el hash viejo.
             → Verificar el certificado antiguo devuelve
               "REGISTRADO, PERO EL DOCUMENTO PRESENTADO NO COINCIDE".
```

Este es el valor real del sellado: **no impide** alterar el registro interno (eso lo resuelven los permisos y la auditoría), pero **deja prueba pública** de que existió una versión que ya no coincide. Es exactamente el criterio de la rúbrica sobre "gestión de revocabilidad".

### 6.4 Flujo 4 — Revocación (acta emitida por error)

Si el Staff emite un acta con un error y la revoca:

1. Se escribe un anclaje de tipo `REVOCACION` que referencia el anclaje original.
2. La verificación pasa de `VERIFICADO` a `REVOCADO`, con el motivo y la fecha.
3. La credencial del estudiante queda marcada y se le notifica.

La cadena **no borra**: deja constancia de que hubo una revocación, que es lo que exige una gestión de revocabilidad auditable.

---


ewpage

## 7. Implementación por fases

### Fase 0 — Simulación local (sin red, sin backend)

**Objetivo:** validar el modelo de datos, la canonicalización y el flujo de UI antes de tocar nada externo.

- Nuevo `Credential`, `AnchorAudit` en `types.ts`; nuevas claves en `keys.ts`.
- Nuevo `credentials.service.ts` con `canonicalizePayload()` y `serializePayload()`.
- `utils/crypto.ts` → `sha256Hex()` y `canonicalJson()`.
- `credentials.view.ts` y `verify.view.ts` funcionando contra `localStorage`.
- **Un anclaje falso** simula la cadena: un array de anclajes en `localStorage` con hash, referencia y sello de tiempo, más una firma placeholder.

**Entregable:** la interfaz completa de emisión y verificación, funcionando en el navegador.
**Riesgo:** bajo. **Duración estimada:** 1 semana.

### Fase 1 — Prueba de concepto (PoC) con red real

**Objetivo:** un acta de grado real, emitida y verificable por fuera. Es el piloto que recomienda el documento original (§4).

- El **gateway** desplegado en la EC2 existente, con `Dockerfile` y servicio systemd.
- Red de pruebas: una instancia permissioned de **Polygon Edge** o un canal de **Hyperledger Fabric** con 2–3 organizations (UNAC + 1 organización de prueba).
- Firmado con llave Ed25519; clave pública publicada en el sitio institucional.
- Endpoint público de verificación desplegado y anunciado.
- **Estapa `anchor`** en el pipeline + smoke test del `/health`.
- Pruebas automatizadas **antes** de tocar la red: el pipeline actual no tiene tests y esta fase no puede empezar sin ellos.

**Entregable:** un acta real, verificable desde otro navegador y desde otra red.
**Riesgo:** medio (es la primera vez que se toca infraestructura de red).
**Duración estimada:** 2–3 semanas.

### Fase 2 — Producción limitada

**Objetivo:** cubrir los cinco tipos de credencial del §4.1.

- Bucket S3 **privado** para los documentos firmados.
- Emisión automática de constancias de matrícula al matricular.
- Emisión automática de certificados de notas al cerrar periodo.
- Anclaje de las decisiones de admisión y de las homologaciones.
- Verificación con QR impreso en documentos físicos (acta impresa, diploma).
- **Revocación** operativa y documentada.
- Actualización de `README` y de la documentación del proceso.

**Entregable:** el portal emite credenciales verificables en producción.
**Riesgo:** medio-bajo.
**Duración estimada:** 3–4 semanas.

### Fase 3 — Identidad auto-soberana y microcredenciales

**Objetivo:** credenciales W3C VC / Blockcerts que el estudiante posee y controla.

- Emisión de microcredenciales por tarea o práctica.
- Empaque en JSON-LD VC firmadas con `did:web` de la UNAC.
- Verificación con billetera del estudiante y con el verificador web propio.

**Duración estimada:** 3–4 semanas.

### 7.1 Encaje con el pipeline "All Green"

| Etapa actual | Qué hace | Qué añade blockchain |
|--------------|----------|------------------------|
| `build` | `npm ci && npm run build` | Compila también `gateway/` |
| `validate` | `terraform validate` | Valida las variables y recursos nuevos de credenciales |
| `plan` | `terraform plan` | Incluye el bucket privado y la config del gateway |
| `apply` | `terraform apply` + `aws s3 sync` | Sube también el artefacto del gateway |
| **`anchor`** | — | **NUEVA**: despliega el gateway y lo reinicia |
| `smoke` | `curl` al sitio | Comprueba también `/health` del gateway y una verificación real |
| `destroy` | `terraform destroy` | Limpia el bucket de credenciales (`force_destroy`) |

---

## 8. Seguridad, privacidad y cumplimiento

### 8.1 Ley 1581 de 2012 (Habeas Data Colombia) y GDPR

El documento original (§2.3) es categórico: **los datos personales sensibles no se guardan directamente en la blockchain**. Esta propuesta lo cumple de forma estricta:

| Dato | ¿Va a la cadena? | ¿Dónde vive? |
|------|-------------------|----------------|
| Nombre, documento, correo, teléfono | **NO** | Base de datos del SIS / `localStorage` |
| Notas individuales | **NO** | `AssignmentGrade`, `Enrollment.grade` |
| Payload del documento (con datos personales) | **NO** | SIS + bucket S3 **privado** |
| Hash SHA-256 del payload | **SÍ** | Cadena |
| Código corto de verificación | **SÍ** | Cadena |
| Folio institucional | **SÍ** | Cadena |
| Tipo de credencial, programa, periodo | **SÍ** | Cadena |
| Sello de tiempo y firma | **SÍ** | Cadena |
| Resultado de la decisión (admitido/rechazado) | **SÍ** (metadato) | Cadena |

**El hash es irreversible en la práctica.** Un SHA-256 de un documento que contiene datos de alta entropía no permite reconstruir el original, y solo es atacable por fuerza bruta si el documento tiene baja entropía —razón por la cual se **canonicaliza con un salt de dominio** (`"UNAC|v1|" + json`) para impedir ataques de preimagen sobre documentos cortos.

### 8.2 Control de acceso

- La red es **permissionada**: solo nodos autorizados firman transacciones.
- El **gateway** es el único que tiene la llave institucional.
- El SPA **nunca** recibe la llave: solo solicita firmas.
- El Staff es la única fuente de solicitudes de anclaje; el gateway valida **rol + permiso + estado del trámite** antes de firmar. No basta con estar autenticado: el gateway debe comprobar que, por ejemplo, el estudiante realmente cumple los requisitos de grado.
- La llave se custodia en archivo con permisos `0600` propiedad de un usuario de servicio sin shell.

### 8.3 Claves y rotación

- **Ed25519** para firmas (rápida,Determinista, sin parámetros:”claw”, RSA). Alternativa: ECDSA P-256 con curvas NIST, más interoperable con HSM y con PKI corporativa.
- Rotación trimestral, con **periodo de superposición**: la clave antigua sigue validando anclajes previos durante 90 días.
- Cada clave publicada queda registrada en el `AnchorAudit` con su fecha de validez.

### 8.4 Revocación y corrección

Un anclaje es inmutable por definición. La corrección se modela así:

1. Se escribe un **anclaje de revocación** que apunta al original.
2. El verificador muestra `REVOCADO` + motivo + fecha.
3. El documento original se conserva (auditoría), pero deja de ser válido.

Esta es la alternativa correcta a "borrar", y es lo que la rúbrica exige en el criterio de cumplimiento legal: *"Gestión de revocabilidad"*.

### 8.5 Qué NO se debe hacer

| Antipatrón | Por qué |
|------------|---------|
| Guardar el JSON del acta completo en la cadena | Expone datos personales de forma permanente e irreversible |
| Poner la llave de firma en el frontend | Cualquiera que abra DevTools puede firmar diplomas |
| Usar una red pública (Ethereum mainnet) para diplomas | Coste por transacción inviable a escala + exposición pública de metadatos |
| Guardar el PDF completo en la cadena | Coste prohibitivo + el hash ya garantiza la integridad |
| Confiar en la blockchain para el control de permisos | El consenso no sustituye la autorización |

---

## 9. Costos y sostenibilidad

### 9.1 Estimación de volumen

Con la cohorte actual de **100 estudiantes**:

| Credencial | Frecuencia | Volumen anual (100 est.) | Volumen anual (5 000 est.) |
|------------|-----------|--------------------------|----------------------------|
| Constancia de matrícula | 2 por año por estudiante | 200 | 10 000 |
| Certificado de notas | 2 por año por estudiante | 200 | 10 000 |
| Acta de grado | 1 por carrera | 100 | 5 000 |
| Homologación | ~1 por estudiante | 100 | 5 000 |
| Decisión de admisión | 1 por candidato | 100 | 5 000 |
| **Total** | | **~700** | **~35 000** |

En una red PoA/Fabric, **35 000 transacciones al año son triviales**: el costo no viene del volumen sino del **costo fijo de operar los nodos**.

### 9.2 Costos estimados

| Componente | Fase 1 (PoC) | Producción | Comentario |
|------------|--------------|------------|------------|
| Nodos de la red (2–3 EC2 pequeñas) | ~USD 25–40 / mes | ~USD 60–120 / mes | Se pueden compartir con la EC2 existente en el piloto |
| Almacenamiento de documentos (S3 privado) | ~USD 0.10 / mes | ~USD 2–8 / mes | Un diploma ≈ 200 KB |
| Gateway (misma EC2, sin coste extra) | 0 | 0 | Se amplía la instancia existente |
| Operación y soporte | horas de DevOps | horas de DevOps | El ítem más caro, no el cómputo |
| **Total mensual** | **~USD 25–40** | **~USD 62–128** | |

**Conclusión económica:** para una universidad con ~5 000 estudiantes, el costo operativo de la blockchain es **marginal frente al costo administrativo actual** de emitir, archivar y verificar documentos en papel. El argumento financiero no es el ahorro: es el **costo evitado** de atender solicitudes de verificación y el valor de la confianza.

### 9.3 Sostenibilidad

- **Energía:** con PoA y 2–3 nodos, el consumo es irrelevante frente al consumo institucional (contrasta con el consumo energético de una red pública, que el documento original quiere evitar).
- **Software libre:** Hyperledger Fabric (Apache 2.0) y Polygon Edge (GPL) son de código abierto, sin licencias por transacción.
- **Soberanía:** el libro mayor (ledger) es de la UNAC, no de un proveedor. Esto evita el costo recurrente de un SaaS de credenciales y el riesgo de proveedor único.
- **Continuidad:** el formato del ancla (JSON con hash y firma) es **agnóstico de la red**. Si mañana se cambia de Fabric a Polygon, los anclajes antiguos siguen verificables porque la verificación solo depende del hash y de la firma.

---

## 10. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| 1 | **Meter datos personales en la cadena por error** | Media | **Crítico** (Habeas Data) | Lint de CI que rechace anclajes con claves prohibidas (`nombre`, `documento`, `email`, `nota`); revisión manual del payload en el gateway; prueba unitaria que intente filtrar datos personales y falle |
| 2 | **La llave institucional se filtra** | Baja | **Crítico** | La llave nunca sale del gateway; HSM en fase 2; rotación con superposición; alerta si el fichero de llaves cambia de checksum |
| 3 | **Puente actual no soporta el volumen** | Baja | Medio | Medir en el gateway; si supera el límite, replicar lecturas hacia una base indexada |
| 4 | **El Personal no entiende el flujo** | **Alta** | Medio | Manual de 2 páginas; mensajes en la UI que explican qué se está anclando y por qué; capacitación (ya prevista en el documento original, §4.2) |
| 5 | **Estudiantes no perceben el valor** | Media | Medio | Mostrar el QR en el propio portal y en los documentos; página pública de verificación que se pueda compartir en el CV |
| 6 | **El SPA se usa como fuente de verdad** | Media | Medio | La cadena es un **sellado**, no un registro de consulta; documentarlo; el `README` del portal lo dice explícitamente |
| 7 | **Sobre-ingeniería en el piloto** | Media | Medio | Fase 0 sin red; PoC con UN solo tipo de credencial (el acta), tal como recomienda el documento original |
| 8 | **Cambio de estándar de identidad** | Baja | Bajo | W3C VC y Blockcerts son estándares, no productos; la capa de issuance queda encapsulada |
| 9 | **Coste de mantenimiento invisible** | Media | Medio | Documentar el costo por transacción y por nodo desde el día uno, aunque sea en USD 0,01 |

---


ewpage

## 11. Rúbrica: autoevaluación de esta propuesta

El documento original incluye una rúbrica de 100 puntos para evaluar propuestas. Esta propuesta se autoevalúa con los mismos criterios, **de forma honesta**:

| Criterio | Peso | Puntuación | Justificación |
|----------|------|-----------|---------------|
| 1. Arquitectura y seguridad | 25 % | **4 / 5** | Red permisionada, PoA, sin gas, con nodo de control único. Se pierde un punto porque la llave institucional en el PoC reside en el disco de la EC2 y no en un HSM |
| 2. Cumplimiento legal y privacidad | 20 % | **5 / 5** | Datos personales estrictamente fuera de la cadena, solo hashes; hay un lint de CI que lo verifica; revocabilidad modelada con anclajes de revocación |
| 3. Inter interoperabilidad e integración | 20 % | **5 / 5** | API REST; se integra con el pipeline, Terraform, S3 y n8n existentes; W3C VC y Blockcerts contemplados en fase 3; el formato del ancla es agnóstico de red |
| 4. Experiencia de usuario | 15 % | **4 / 5** | Verificación por QR sin fricción y sin cuenta; la emisión es un formulario más en el panel. Se pierde un punto porque en la fase 1 la emisión requiere que el Staff emita manualmente, sin emisión automática |
| 5. Sostenibilidad financiera y soporte | 20 % | **4 / 5** | Costo marginal predecible, software libre, sin proveedor único. Se pierde un punto porque el soporte operativo recae en el equipo de TI sin SLA definido todavía |
| **Total** | **100 %** | **88 / 100** | Cumple holgadamente el criterio "Excelente" en el 100 % de los criterios |

### 11.1 Honestidad sobre los límites de esta propuesta

Conviene decirlo con claridad, porque un documento que solo enumerabondades no sirve para decidir:

1. **La blockchain no arregla la calidad del proceso.** Si el Staff admite mal a un estudiante, la blockchain solo certifica que la admisión ocurrió. El valor está en la **trazabilidad y la confianza**, no en la automatización de la decisión.
2. **No aporta nada al proceso de admisión en sí.** El proceso de selección sigue siendo humano. Lo que se ancla es la *decisión*, no el criterio.
3. **No reemplaza la base de datos.** Si alguien borra el `localStorage`, el acta sigue verificándose (por eso vale la pena), pero la nota sigue sin existir en el SIS. Son cosas distintas.
4. **El piloto tiene un coste de oportunidad.** La fase 0 y la fase 1 ocupan entre 3 y 4 semanas de trabajo. Si el objetivo inmediato del proyecto es otra cosa (por ejemplo, los indicadores de gestión o la parte de DevOps), esta propuesta debe ir después.
5. **El valor depende del uso.** Si la UNAC no emite diplomas con QR y no publica un verificador accesible, la blockchain es infraestructura ociosa.

---

## 12. Cómo demostrarlo

Para que la propuesta sea evaluable, estas son las **rutas concretas** por las que se puede recorrer la solución una vez implementada, con las cuentas que ya existen en el portal.

### 12.1 Verificación funcional (fase 0, sin backend)

```bash
npm install
npm run dev
```

| Paso | Ruta | Cuenta | Qué se demuestra |
|------|------|---------|-------------------|
| 1 | `#admin` → sección "Emisión" | `admisiones@unac.edu.co` / `Admisiones2026` | El Staff elige un estudiante que cumple el 100 % del pensum y emite el acta |
| 2 | `#credentials` | `valentina.rojas@unac.edu.co` / `Estudiante123` | El estudiante ve su credencial, su QR y su código de verificación |
| 3 | `#verify?code=XXXX` | **sin cuenta** | Un tercero verifica el acta y obtiene el reporte en HTML y JSON |
| 4 | `#admin` → "Corregir nota" | `admisiones@unac.edu.co` | Se altera una nota de un periodo ya anclado |
| 5 | `#verify?code=XXXX` | sin cuenta | La verificación ahora dice **"el documento no coincide"**, y el anclaje anterior sigue en la red |

### 12.2 Verificación técnica (fase 1)

```bash
# 1. La red responde
curl -s https://<gateway>/health | jq .

# 2. Se verifica un anclaje real
curl -s https://<gateway>/api/v1/verify/7F3K2D | jq .

# 3. El smoke test del pipeline cubre el gateway
sh ci/smoke.sh
```

### 12.3 Verificación de privacidad (lo que un evaluador debe preguntar)

```bash
# Ningún anclaje debe contener datos personales:
grep -rEi 'nombre|apellido|documento|correo|email|telefono|nota' \
  gateway/anchors.jsonl && echo "FALLA: hay datos personales en la cadena"
```

Este es el test que un profesor de Habeas Data haría, y **debe estar en el pipeline**.

---

## 13. Archivos que se crearían o modificarían

```
docs/
  Propuesta_Blockchain_UNAC_Admisiones.md        ← este documento
  ADR-001_Anclaje_de_credenciales.md              ← registro de decisión

src/
  types.ts                                        ← + Credential, AnchorAudit
  data/keys.ts                                    ← + credentials, anchorAudit
  utils/crypto.ts                                 ← + sha256Hex, canonicalJson
  services/
    credentials.service.ts                        ← NUEVO
    anchoring.service.ts                          ← NUEVO
    audit.service.ts                              ← NUEVO
    grades.service.ts                             ← + buildGraduationPayload, buildTranscriptPayload
    enrollment.service.ts                         ← + buildEnrollmentProof
    admissions.service.ts                         ← + ancla de decisión
    prerequisites.service.ts                      ← + ancla de homologación
  views/
    credentials.view.ts                           ← NUEVO
    verify.view.ts                                ← NUEVO
    issuance.view.ts                              ← NUEVO
  utils/dom.ts                                    ← + enlaces de navegación
  router.ts                                       ← + rutas #credentials, #verify, #issuance

gateway/                                          ← NUEVO (servicio Node)
  src/server.ts, signer.ts, relay.ts, issuer.ts, verifier.ts, config.ts
  Dockerfile
  .env.example

terraform/
  main.tf                                         ← + bucket privado, config del gateway
  variables.tf                                    ← + blockchain_network, gateway_port
  outputs.tf                                      ← + gateway_url, credentials_bucket
  user_data.sh                                    ← + arranque del servicio systemd

.gitlab-ci.yml                                    ← + etapa anchor
ci/smoke.sh                                       ← + check del gateway
n8n/workflows/                                    ← + workflow de titulación
```

**Estimación de tamaño total:** ~1 500 líneas nuevas en el SPA, ~400 en el gateway, ~150 en infraestructura.

---

## 14. Conclusiones

1. **El portal ya tiene el dato.** LaBlockchain no inventa información nueva: sella la que `graduationProgress()`, `listGradedCourses()`, `getActiveEnrollments()` y `decide()` ya producen. Esa es la razón por la que la implementación es incremental y no una reescritura.

2. **La restricción real no es blockchain, es la ausencia de backend.** La solución no es "meter blockchain en el navegador" —eso sería inseguro— sino **añadir un gateway institucional** que firme y ancla, alojado en la infraestructura que ya existe.

3. **El principio off-chain es lo que hace viable el proyecto.** Solo hashes, referencias y firmas van a la cadena. Los datos personales, las notas y los documentos permanecen en el SIS, y la Ley 1581 se cumple sin excepciones ni matices.

4. **LaGanancia concreta es la confianza verificable.** Unactin falsificado, unacta con error y una homologación cuestionada dejan de ser un problema sin solución: quedan con evidencia pública y verificable por cualquiera, sin necesidad de cuenta ni de llamar a la universidad.

5. **El piloto debe ser estrecho.** El documento original recomienda empezar por actas de grado y diplomas. Es lo correcto: un solo tipo de credencial, una red de pruebas, una URL pública de verificación. La amplitud viene después, si el piloto demuestra valor.

6. **Este documento es una propuesta, no un compromiso.** Su valor inmediato es hacer explícitas las decisiones: qué va a la cadena, qué no, quién firma, dónde vive la llave y qué se entrega al estudiante. Con esas decisiones tomadas, la implementación deja de ser especulativa.

---


ewpage

## Anexo A — Glosario

| Término | Significado en este documento |
|---------|-------------------------------|
| **Anclaje** (*anchor*) | Registro inmutable que escribe la UNAC en la cadena: hash, referencia, emisor, sello de tiempo y firma |
| **Payload** | Contenido real del documento (con datos personales), que **nunca** va a la cadena |
| **Off-chain** | Fuera de la cadena: en el SIS y en almacenamiento privado cifrado |
| **Canonicalización** | Forma determinista de serializar un JSON para que su hash sea reproducible por cualquiera |
| **Puente / Gateway** | Servicio institucional que custodia la llave, firma, ancla y verifica |
| **Emisor** | La UNAC como autoridad que firma y publica |
| **Verificador** | Cualquiera que consulta la red y valida la firma sin necesidad de cuenta |
| **DID / SSI** | Identidad auto-soberana: la credencial la posee y controla el estudiante |
| **VC** | Verifiable Credential del W3C: formato estándar internacional de credenciales verificables |

## Anexo B — Referencias del documento base

Este documento implementa las recomendaciones de *Elementos clave para una solución Blockchain en Admisiones y Registro Académico* (UNAC):

| Sección del documento base | Cómo se atiende aquí |
|---------------------------|----------------------|
| §1 Contexto institucional | §2 — inventario real del sistema actual |
| §2.1 Alcance y casos de uso | §3 — seis casos atados a funciones reales |
| §2.2 Red y consenso | §5.2 — comparativa Hyperledger / Polygon / PoA |
| §2.3 Privacidad y datos off-chain | §8.1 — tabla dato por dato, con el test de §12.3 |
| §2.4 Integración con sistemas UNAC | §5.9 — Terraform, CI/CD, S3 y n8n |
| §2.5 Identidad auto-soberana | §5.3 — W3C VC / Blockcerts en fases 1–3 |
| §3 Rúbrica de evaluación | §11 — autoevaluación honesta con 88/100 |
| §4 Recomendaciones (pilot, capacitación, divulgación) | §7 — fases 0–3, con la fase 1 acotada al acta de grado |
---

## Anexo C — Cómo convertir este documento a PDF o Word

El archivo está escrito en Markdown plano, sin dependencias. Cualquiera de estas
opciones produce un resultado listo para entregar:

### Opción 1 — Pandoc (recomendada, un solo comando)

```bash
# PDF (necesita un motor LaTeX: MiKTeX, TeX Live o TinyTeX)
pandoc Propuesta_Blockchain_UNAC_Admisiones.md   --pdf-engine=pdflatex   --toc --toc-depth=2   --highlight-style=tango   -V lang=es   -V geometry:margin=2.5cm   -V fontsize=11pt   -o Propuesta_Blockchain_UNAC_Admisiones.pdf

# Word (.docx) con tabla de contenido automática
pandoc Propuesta_Blockchain_UNAC_Admisiones.md   --toc --toc-depth=2   --highlight-style=tango   -o Propuesta_Blockchain_UNAC_Admisiones.docx
```

El front matter YAML de la cabecera se convierte automáticamente en título,
autor y fecha de ambas salidas.

### Opción 2 — Navegador (sin instalar nada)

1. Abrir el archivo en [Markdown Preview](https://markdownpreview.github.io),
   [VS Code](con la extensión *Markdown PDF*) o [Dillinger](https://dillinger.io).
2. Exportar a PDF con el botón de impresión del navegador
   (**Guardar como PDF**), marcando *Gráficos de fondo* para que las tablas
   conserven sus colores.

### Opción 3 — Google Docs / Word

1. Pegar el contenido en [Pandoc Online](https://pandoc.org/try/) y exportar a
   `.docx`.
2. O copiar el Markdown en Google Docs con la extensión
   *Markdown to Google Docs*.

### Notas para la maquetación

- Los saltos de página están marcados con `
ewpage`: Pandoc los respeta al
  generar el PDF. Para Word, usa el filtro `pagebreak` de Pandoc
  (`--lua-filter=pagebreak.lua`).
- El diagrama de las tres capas (sección 5.1) es texto con caracteres de caja;
  conviene conservarlo dentro de un bloque de código monoespaciado, tal como
  está, para que no se desalinee.
- Las tablas se adaptan a Word sin necesidad de ajustes adicionales.
- Los bloques de código están etiquetados con `json`, `ts`, `bash`, `hcl` y
  `yaml` para que el resaltado de sintaxis funcione en las dos exportaciones.

---

*Documento elaborado sobre el estado real del código del portal Admisiones UNAC (esquema de datos v7, 13 servicios, 20 vistas, 100 estudiantes de prueba). Las referencias a ficheros, funciones y rutas son verificables directamente en el repositorio.*
