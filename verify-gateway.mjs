/**
 * Prueba end-to-end del gateway institucional: lo levanta, emite una
 * credencial, la verifica, detecta una alteración y la revoca.
 *   node verify-gateway.mjs
 *
 * No necesita el navegador ni el portal: solo el gateway y Node.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GATEWAY_DIR = resolve("gateway");
const DATA_DIR = resolve(GATEWAY_DIR, "data");
const KEYS_DIR = resolve(GATEWAY_DIR, "keys");
const PORT = 3087;
const BASE = `http://localhost:${PORT}`;
const TOKEN = "token-de-prueba-123";


/**
 * Serializacion canonica: las claves se ordenan, igual que en el portal
 * (src/utils/crypto.ts) y en el gateway (src/verifier.js). Si el hash se
 * calculara con JSON.stringify a pelo, el orden de las claves cambiaria el
 * hash y la verificacion fallaria.
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

let failures = 0;
function check(label, ok, extra = "") {
  const passed = Boolean(ok);
  if (!passed) failures += 1;
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${extra ? ` -> ${extra}` : ""}`);
}

// ------------------------------------------------------------------
// Preparación: datos limpios y llaves nuevas
// ------------------------------------------------------------------
rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(resolve(KEYS_DIR, "unac-signing-key.pem"))) {
  console.log("Falta la llave de firma. Ejecuta: cd gateway && npm run keys");
  process.exit(1);
}

// ------------------------------------------------------------------
// Arranque del gateway
// ------------------------------------------------------------------
const gateway = spawn("node", ["src/server.js"], {
  cwd: GATEWAY_DIR,
  env: {
    ...process.env,
    PORT: String(PORT),
    CHAIN_FILE: resolve(DATA_DIR, "anchors.jsonl"),
    STAFF_TOKEN: TOKEN,
    ALLOWED_ORIGINS: "http://localhost:5173",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let gatewayLog = "";
gateway.stdout.on("data", (chunk) => (gatewayLog += chunk));
gateway.stderr.on("data", (chunk) => (gatewayLog += chunk));

async function waitForReady(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch {
      /* todavía no levanta */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function stop() {
  gateway.kill();
}

const ready = await waitForReady();
check("el gateway levanta y responde /health", ready, gatewayLog.slice(0, 200));
if (!ready) {
  stop();
  process.exit(1);
}

try {
  // --------------------------------------------------------------
  console.log("\n--- 1. Salud e integridad de la cadena ---");
  const health = await (await fetch(`${BASE}/health`)).json();
  check("el health reporta ok", health.ok === true);
  check("la cadena está intacta", health.cadenaIntacta === true);
  check("la llave de firma está cargada", health.llaveCargada === true);
  check("el relay es el de archivo", health.relay === "file", health.relay);

  // --------------------------------------------------------------
  console.log("\n--- 2. Control de acceso ---");
  const sinToken = await fetch(`${BASE}/api/v1/anchors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "ACTA_GRADO", code: "AAA111", reference: "X", payloadHash: "a".repeat(64) }),
  });
  check("escribir sin token es rechazado", sinToken.status === 401, `(${sinToken.status})`);

  const tokenMalo = await fetch(`${BASE}/api/v1/anchors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Gateway-Token": "incorrecto" },
    body: JSON.stringify({ type: "ACTA_GRADO", code: "AAA111", reference: "X", payloadHash: "a".repeat(64) }),
  });
  check("escribir con token incorrecto es rechazado", tokenMalo.status === 401, `(${tokenMalo.status})`);

  // --------------------------------------------------------------
  console.log("\n--- 3. Firma y anclaje ---");
  const payload = {
    tipo: "ACTA_GRADO",
    programa: "Ingeniería de Sistemas",
    promedio: 4.19,
    creditosAprobados: 105,
    materias: [
      { codigo: "ISI-101", materia: "Algoritmos y Programación", creditos: 4, nota: 4.4, aprobada: true },
      { codigo: "ISI-201", materia: "Estructuras de Datos", creditos: 4, nota: 4.2, aprobada: true },
    ],
  };
  const payloadHash = createHash("sha256")
    .update(`UNAC|v1|${canonicalJson(payload)}`)
    .digest("hex");

  const emitido = await (
    await fetch(`${BASE}/api/v1/anchors`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Gateway-Token": TOKEN },
      body: JSON.stringify({
        type: "ACTA_GRADO",
        code: "TEST01",
        reference: "UNAC-2026-AG-000001",
        programId: "prog-sistemas",
        periodId: "per-2026-2",
        payloadHash,
        payload,
      }),
    })
  ).json();
  check("el anclaje devuelve ok", emitido.ok === true);
  check("devuelve el id del anclaje", Boolean(emitido.anchorId));
  check("devuelve la firma", typeof emitido.signature === "string" && emitido.signature.length > 20);
  check("devuelve el sello de tiempo", Boolean(emitido.signedAt));

  // --------------------------------------------------------------
  console.log("\n--- 4. La cadena no guarda datos personales ---");
  const cadena = readFileSync(resolve(DATA_DIR, "anchors.jsonl"), "utf8");
  check("la cadena no contiene el nombre de la materia", !cadena.includes("Algoritmos"));
  check("la cadena no contiene la nota", !cadena.includes("4.4"));
  check("la cadena sí contiene el hash", cadena.includes(payloadHash));
  check("la cadena encadena con el anclaje anterior", cadena.includes("previousHash"));
  const documentos = readFileSync(resolve(DATA_DIR, "anchors.documents.json"), "utf8");
  check("el documento se guarda fuera de la cadena", documentos.includes("Algoritmos"));

  // --------------------------------------------------------------
  console.log("\n--- 5. Verificación ---");
  const verificacion = await (await fetch(`${BASE}/api/v1/verify/TEST01`)).json();
  check("la verificación dice VERIFICADO", verificacion.verified === true, verificacion.status);
  check("la verificación expone el hash", verificacion.anchor?.payloadHash === payloadHash);
  check("la verificación NO expone el payload", verificacion.anchor?.payload === undefined);

  const inexistente = await fetch(`${BASE}/api/v1/verify/ZZZZZZ`);
  check("un código inexistente responde 404", inexistente.status === 404, `(${inexistente.status})`);

  // --------------------------------------------------------------
  console.log("\n--- 6. Detección de alteraciones ---");
  const alterado = { ...payload, promedio: 5.0, creditosAprobados: 999 };
  const chequeo = await (
    await fetch(`${BASE}/api/v1/verify-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TEST01", payload: alterado }),
    })
  ).json();
  check("un documento alterado se detecta", chequeo.verified === false && chequeo.status === "ALTERADO", chequeo.status);
  check("el mensaje explica el motivo", chequeo.detail.includes("cambió"), chequeo.detail.slice(0, 50));

  const intacto = await (
    await fetch(`${BASE}/api/v1/verify-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TEST01", payload }),
    })
  ).json();
  check("el documento intacto verifica", intacto.verified === true, intacto.status);

  // --------------------------------------------------------------
  console.log("\n--- 7. Documento imprimible y página pública ---");
  const documento = await fetch(`${BASE}/api/v1/credentials/TEST01.html`);
  const html = await documento.text();
  check("el documento se sirve como HTML", documento.ok && html.includes("Acta de grado"));
  check("el documento incluye el hash", html.includes(payloadHash));
  check("el documento incluye la firma", html.includes(emitido.signature));
  check("el documento incluye las materias", html.includes("Algoritmos"));

  const pagina = await fetch(`${BASE}/verify/TEST01`);
  const htmlPagina = await pagina.text();
  check("la página pública de verificación responde 200", pagina.status === 200);
  check("la página muestra VERIFICADO", htmlPagina.includes("VERIFICADO"));

  // --------------------------------------------------------------
  console.log("\n--- 8. Revocación ---");
  const revocacion = await (
    await fetch(`${BASE}/api/v1/revocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Gateway-Token": TOKEN },
      body: JSON.stringify({ code: "TEST01", reason: "Error en el promedio" }),
    })
  ).json();
  check("la revocación se registra", revocacion.ok === true);
  check("la revocación escribe un anclaje nuevo", Boolean(revocacion.revocacion?.anchorId));
  const cadenaFinal = readFileSync(resolve(DATA_DIR, "anchors.jsonl"), "utf8");
  check("el anclaje original no se borra", cadenaFinal.includes(payloadHash));
  check("la revocación queda en la cadena", cadenaFinal.includes("REVOCACION"));
  const saludFinal = await (await fetch(`${BASE}/health`)).json();
  check("la cadena sigue intacta tras revocar", saludFinal.cadenaIntacta === true);

  // --------------------------------------------------------------
  console.log("\n--- 9. Detección de manipulación de la cadena ---");
  const lineas = readFileSync(resolve(DATA_DIR, "anchors.jsonl"), "utf8").trim().split("\n");
  const manipulator = JSON.parse(lineas[0]);
  manipulator.payloadHash = "f".repeat(64);
  lineas[0] = JSON.stringify(manipulator);
  writeFileSync(resolve(DATA_DIR, "anchors.jsonl"), lineas.join("\n"));
  const saludAlterada = await (await fetch(`${BASE}/health`)).json();
  check("manipular un anclaje rompe la cadena", saludAlterada.cadenaIntacta === false, `(${saludAlterada.cadenaIntacta})`);
} finally {
  stop();
}

console.log(failures === 0 ? "\nTODAS LAS VERIFICACIONES DEL GATEWAY PASARON" : `\n${failures} VERIFICACIONES FALLARON`);
process.exit(failures === 0 ? 0 : 1);
