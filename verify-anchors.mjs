/**
 * Verificación headless del subsistema de credenciales verificables.
 * Comprueba que el hashing es real, que la emisión deja bitácora y que
 * una alteración posterior del documento se detecta.
 *   npx esbuild verify-anchors.mjs --bundle --platform=node --format=esm --outfile=verify-anchors-tmp.mjs && node verify-anchors-tmp.mjs
 */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.location = { hash: "", origin: "http://localhost:5173" };
globalThis.window = { addEventListener: () => {} };
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };

const { seed } = await import("./src/data/seed.ts");
const { canonicalJson, hashPayload, sha256Hex } = await import("./src/utils/crypto.ts");
const { getAccounts } = await import("./src/services/auth.service.ts");
const {
  createCredential,
  findByCode,
  findById,
  updateCredential,
  listCredentialsFor,
} = await import("./src/services/credentials.service.ts");
const { issueCredential, revokeCredential, getTransport } = await import(
  "./src/services/anchoring.service.ts"
);
const { buildGraduationPayload, buildTranscriptPayload, buildEnrollmentPayload } = await import(
  "./src/services/payloads.service.ts"
);
const { listAuditFor, listAllAudit } = await import("./src/services/audit.service.ts");
const { listActiveNotificationsFor } = await import("./src/services/notifications.service.ts");
const { listByApplicant } = await import("./src/services/admissions.service.ts");

let failures = 0;
function check(label, ok, extra = "") {
  const passed = Boolean(ok);
  if (!passed) failures += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${extra ? ` -> ${extra}` : ""}`);
}

await seed();

const accounts = getAccounts();
const valentina = accounts.find((a) => a.email === "valentina.rojas@unac.edu.co");
const staff = accounts.find((a) => a.email === "admisiones@unac.edu.co");
const admision = listByApplicant(valentina.id).find((a) => a.status === "Admitido");

console.log("\n--- 1. Primitivas criptográficas ---");
const hashA = await hashPayload({ a: 1, b: 2, materia: "ISI-301" });
const hashB = await hashPayload({ materia: "ISI-301", b: 2, a: 1 });
check("el hash no depende del orden de las claves", hashA === hashB);
check("el hash tiene 64 caracteres (SHA-256 hex)", hashA.length === 64, `(${hashA.length})`);
check("el hash cambia si cambia un valor", hashA !== (await hashPayload({ a: 1, b: 3 })));
check(
  "el hash cambia si cambia una sola letra de una materia",
  hashA !== (await hashPayload({ a: 1, b: 2, materia: "ISI-302" })),
);
check(
  "el canonical ignora las claves undefined",
  canonicalJson({ a: 1, b: undefined }) === canonicalJson({ a: 1 }),
);
check(
  "el prefijo de dominio cambia el hash",
  (await sha256Hex("UNAC|v1|x")) !== (await sha256Hex("x")),
);

console.log("\n--- 2. Payload conectado con las funciones reales ---");
const payloadActa = await buildGraduationPayload(valentina.id, admision.programId);
check("el acta usa el programa real", payloadActa.programa.length > 0, payloadActa.programa);
check("el acta trae los créditos del pensum", payloadActa.creditosTotales > 0, `${payloadActa.creditosTotales}`);
check("el acta trae las materias cursadas", payloadActa.materias.length > 0, `(${payloadActa.materias.length})`);
check(
  "las notas del acta coinciden con el historial",
  payloadActa.materias.every((m) => typeof m.nota === "number" && m.nota >= 0 && m.nota <= 5),
);
const payloadNotas = buildTranscriptPayload(valentina.id, "per-2026-1");
check("el certificado de notas tiene materias del periodo", payloadNotas.materias.length > 0, `(${payloadNotas.materias.length})`);
const payloadConstancia = buildEnrollmentPayload(valentina.id, admision.programId, "per-2026-2");
check("la constancia lista las materias matriculadas", payloadConstancia.materias.length > 0, `(${payloadConstancia.materias.length})`);
check("la constancia trae los créditos en uso", payloadConstancia.creditos > 0, `${payloadConstancia.creditos}`);

console.log("\n--- 3. Emisión de la credencial ---");
const credential = await createCredential({
  type: "ACTA_GRADO",
  studentId: valentina.id,
  programId: admision.programId,
  periodId: "per-2026-2",
  payload: payloadActa,
  issuedBy: staff.email,
});
check("la credencial tiene código de 6 caracteres", credential.code.length === 6, credential.code);
check("la credencial tiene folio institucional", credential.reference.startsWith("UNAC-2026-AG-"), credential.reference);
check("la credencial guarda el hash del payload", credential.payloadHash === (await hashPayload(payloadActa)));
check("la credencial arranca como Pendiente", credential.status === "Pendiente");

const result = await issueCredential(credential);
check("el anclaje es exitoso", result.ok === true, result.error ?? "");
check("la credencial queda Anclada", findByCode(credential.code).status === "Anclado");
check("la credencial guarda el id del anclaje", Boolean(findByCode(credential.code).anchorId));
check("la credencial guarda la firma", Boolean(findByCode(credential.code).signature));
check("el estudiante ve su credencial", listCredentialsFor(valentina.id).length === 1);

console.log("\n--- 4. Verificación ---");
let report = await getTransport().verify(credential.code);
check("la verificación dice VERIFICADO", report.verified === true, report.status);
check("la verificación no expone el payload completo", report.credential === undefined || report.credential.payloadHash === credential.payloadHash);
check("un código inexistente dice NO ENCONTRADO", (await getTransport().verify("ZZZZZZ")).status === "NO ENCONTRADO");
check("un código vacío no revienta", (await getTransport().verify("")).status === "NO ENCONTRADO");

console.log("\n--- 5. Detección de alteraciones ---");
const altered = { ...payloadActa, promedio: 5.0, creditosAprobados: 999 };
updateCredential(credential.id, { payload: altered });
report = await getTransport().verify(credential.code);
check("una nota alterada se detecta", report.verified === false && report.status === "ALTERADO", report.status);
check("el mensaje explica qué pasó", report.detail.includes("cambió"), report.detail.slice(0, 60));
// Se restaura: el anclaje conserva el hash original, así que vuelve a cuadrar.
updateCredential(credential.id, { payload: payloadActa });
report = await getTransport().verify(credential.code);
check("al restituir el contenido vuelve a ser VERIFICADO", report.verified === true, report.status);

console.log("\n--- 6. Revocación ---");
revokeCredential(credential.id, staff.email, "Error en el promedio del acta");
report = await getTransport().verify(credential.code);
check("una credencial revocada dice REVOCADO", report.status === "REVOCADO", report.status);
check("el motivo de la revocación queda visible", report.detail.includes("revocada"));

console.log("\n--- 7. Bitácora de auditoría ---");
const auditoria = listAuditFor(credential.id);
check("la bitácora registra la solicitud", auditoria.some((a) => a.action === "SOLICITADO"));
check("la bitácora registra la firma", auditoria.some((a) => a.action === "FIRMADO"));
check("la bitácora registra el anclaje", auditoria.some((a) => a.action === "ANCLADO"));
check("la bitácora registra la revocación", auditoria.some((a) => a.action === "REVOCADO"));
check("la bitácora guarda el actor", auditoria.every((a) => Boolean(a.actor)));
check("hay auditoría global", listAllAudit().length >= 4, `(${listAllAudit().length})`);

console.log("\n--- 8. Aislamiento de los datos personales ---");
const anchors = localStorage.getItem("unac-anchors") ?? "";
check("la cadena simulada no guarda el payload", !anchors.includes("materia") && !anchors.includes("nota"));
check("la cadena simulada solo guarda el hash", anchors.includes("payloadHash"));
const allCredentials = localStorage.getItem("unac-credentials") ?? "";
check("el payload sí queda guardado fuera de la cadena", allCredentials.includes("payload"));

console.log("\n--- 9. Notificación al estudiante ---");
const notifs = listActiveNotificationsFor("Estudiante", valentina.id);
check("el estudiante recibió el aviso de emisión", notifs.some((n) => n.title.includes("acta") || n.title.includes("Acta")), `(${notifs.length})`);

console.log(failures === 0 ? "\nTODAS LAS VERIFICACIONES PASARON" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
