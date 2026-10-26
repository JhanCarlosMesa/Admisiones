import { createServer } from "node:http";
import { resolve } from "node:path";
import { config } from "./config.js";
import { getRelay } from "./chain.js";
import { loadSigner, signHash, getPublicKey } from "./signer.js";
import { verifyCredential, verifyDocument, publicAnchor } from "./verifier.js";
import { renderDocument } from "./issuer.js";
import { createDocumentStore } from "./documents.js";

/**
 * Gateway institucional de credenciales verificables UNAC.
 *
 * Tres responsabilidades:
 *  1. custodiar la llave de firma institucional,
 *  2. firmar y anclar lo que el portal le pide,
 *  3. responder las consultas públicas de verificación.
 *
 * Sin dependencias externas: solo los módulos nativos de Node.
 */

const relay = getRelay(config);
const documents = createDocumentStore(
  resolve(config.chainFile.replace(/\.jsonl$/, ".documents.json")),
  process.env.DOCUMENT_KEY ?? "",
);
let publicKeyPem = "";

function corsHeaders(request) {
  const origin = request.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Gateway-Token",
      Vary: "Origin",
    };
  }
  return {};
}

function sendJson(response, status, body, request) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(request),
  });
  response.end(payload);
}

function sendHtml(response, status, html, request) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    ...corsHeaders(request),
  });
  response.end(html);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("El cuerpo de la petición es demasiado grande."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("El cuerpo no es un JSON válido."));
      }
    });
    request.on("error", reject);
  });
}

function isAuthorized(request) {
  if (!config.staffToken) return false;
  const header = request.headers["x-gateway-token"];
  return typeof header === "string" && header === config.staffToken;
}

/** Página pública de verificación, pensada para una persona. */
function renderVerificationPage(report, base) {
  const anchor = report.anchor;
  const ok = report.verified;
  const rows = anchor
    ? [
        ["Folio", anchor.reference],
        ["Tipo", anchor.type],
        ["Programa", anchor.programId ?? "—"],
        ["Periodo", anchor.periodId ?? "—"],
        ["Hash del documento", anchor.payloadHash],
        ["Sello de tiempo", anchor.signedAt ? new Date(anchor.signedAt).toLocaleString("es-CO") : "—"],
        ["Firma institucional", anchor.signature ?? "—"],
      ]
        .map(([clave, valor]) => `<tr><th>${clave}</th><td>${String(valor)}</td></tr>`)
        .join("")
    : "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Verificación de documento UNAC</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; background: #f4f6fa; color: #0b2545; margin: 0; padding: 48px 20px; }
  main { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 36px 40px; box-shadow: 0 8px 30px rgba(11,37,69,.08); }
  .marca { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #6b7a90; }
  h1 { font-size: 24px; margin: 10px 0 26px; }
  .estado { display: flex; gap: 14px; align-items: flex-start; border-left: 4px solid ${ok ? "#1c7249" : "#a83a26"}; padding: 16px 18px; background: ${ok ? "#f2f9f5" : "#fdf2ef"}; border-radius: 6px; }
  .estado strong { display: block; font-size: 19px; letter-spacing: .05em; }
  .estado span { font-size: 14px; color: #4a5a70; }
  table { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 14px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 8px; text-align: left; vertical-align: top; }
  th { color: #6b7a90; width: 200px; }
  td { word-break: break-all; font-size: 13px; }
  footer { margin-top: 28px; font-size: 12px; color: #6b7a90; }
</style>
</head>
<body>
<main>
  <div class="marca">Corporación Universitaria Adventista &middot; UNAC</div>
  <h1>Verificación de documento</h1>
  <div class="estado">
    <div>
      <strong>${report.status}</strong>
      <span>${report.detail}</span>
    </div>
  </div>
  ${rows ? `<table>${rows}</table>` : ""}
  ${
    anchor
      ? `<footer><a href="${base}/api/v1/credentials/${anchor.code}.html">Ver el documento completo</a></footer>`
      : ""
  }
</main>
</body>
</html>`;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  try {
    // ---------------------------------------------------------- salud
    if (path === "/health") {
      const chain = await relay.verifyChain();
      sendJson(
        response,
        200,
        {
          ok: true,
          servicio: "gateway-blockchain-unac",
          relay: relay.name,
          red: config.relay,
          cadenaIntacta: chain.ok,
          anclajes: chain.length ?? 0,
          llaveCargada: Boolean(publicKeyPem),
        },
        request,
      );
      return;
    }

    // ------------------------------------------- clave pública de firma
    if (path === "/api/v1/public-key" && request.method === "GET") {
      sendJson(response, 200, { publicKey: publicKeyPem }, request);
      return;
    }

    // ------------------------------------------------- escribir anclaje
    if (path === "/api/v1/anchors" && request.method === "POST") {
      if (!isAuthorized(request)) {
        sendJson(
          response,
          401,
          { ok: false, error: "Token de Staff inválido o ausente." },
          request,
        );
        return;
      }
      const body = await readBody(request);
      const required = ["type", "code", "reference", "payloadHash"];
      const missing = required.filter((field) => !body[field]);
      if (missing.length > 0) {
        sendJson(
          response,
          400,
          { ok: false, error: `Faltan campos obligatorios: ${missing.join(", ")}` },
          request,
        );
        return;
      }
      if (!/^[0-9a-f]{64}$/i.test(String(body.payloadHash))) {
        sendJson(
          response,
          400,
          { ok: false, error: "El hash del payload no es un SHA-256 válido." },
          request,
        );
        return;
      }
      const signedAt = new Date().toISOString();
      const signature = signHash(body.payloadHash);
      const entry = await relay.write({
        type: body.type,
        code: body.code,
        reference: body.reference,
        programId: body.programId,
        periodId: body.periodId,
        payloadHash: body.payloadHash,
        signature,
        signedAt,
      });
      // El contenido real del documento se guarda FUERA de la cadena.
      if (body.payload) documents.save(body.code, body.payload);
      sendJson(
        response,
        200,
        {
          ok: true,
          anchorId: entry.id,
          signedAt,
          signature,
        },
        request,
      );
      return;
    }

    // ------------------------------------------------------ verificar
    if (path.startsWith("/api/v1/verify/") && request.method === "GET") {
      const code = decodeURIComponent(path.slice("/api/v1/verify/".length));
      const report = await verifyCredential(relay, code);
      sendJson(response, report.verified ? 200 : 404, report, request);
      return;
    }

    // ------------------------------- verificar un documento presentado
    if (path === "/api/v1/verify-document" && request.method === "POST") {
      const body = await readBody(request);
      const entry = await relay.findByCode(String(body.code ?? ""));
      if (!entry) {
        sendJson(
          response,
          404,
          { verified: false, status: "NO ENCONTRADO", detail: "No hay anclaje con ese código." },
          request,
        );
        return;
      }
      const report = verifyDocument(entry, body.payload ?? {});
      sendJson(response, report.verified ? 200 : 409, report, request);
      return;
    }

    // ----------------------------------------------- listar anclajes
    if (path === "/api/v1/anchors" && request.method === "GET") {
      const entries = await relay.list();
      sendJson(
        response,
        200,
        { total: entries.length, anclajes: entries.map(publicAnchor) },
        request,
      );
      return;
    }

    // ------------------------------------------- revocación de anclaje
    if (path === "/api/v1/revocations" && request.method === "POST") {
      if (!isAuthorized(request)) {
        sendJson(response, 401, { ok: false, error: "Token de Staff inválido." }, request);
        return;
      }
      const body = await readBody(request);
      const entry = await relay.findByCode(String(body.code ?? ""));
      if (!entry) {
        sendJson(response, 404, { ok: false, error: "No hay anclaje con ese código." }, request);
        return;
      }
      // La revocación no borra: escribe un anclaje nuevo que apunta al anterior.
      const signedAt = new Date().toISOString();
      const payloadHash = Buffer.from(
        JSON.stringify({ revoca: entry.payloadHash, motivo: body.reason ?? "" }),
      ).toString("hex");
      const signature = signHash(payloadHash);
      const revocation = await relay.write({
        type: "REVOCACION",
        code: entry.code,
        reference: entry.reference,
        programId: entry.programId,
        periodId: entry.periodId,
        payloadHash,
        signature,
        signedAt,
      });
      sendJson(
        response,
        200,
        { ok: true, revocacion: publicAnchor(revocation), motivo: body.reason ?? "" },
        request,
      );
      return;
    }

    // ------------------------------------- documento imprimible (HTML)
    if (path.startsWith("/api/v1/credentials/") && path.endsWith(".html")) {
      const code = decodeURIComponent(path.slice("/api/v1/credentials/".length, -".html".length));
      const entry = await relay.findByCode(code);
      if (!entry) {
        sendHtml(response, 404, "<h1>No se encontró la credencial</h1>", request);
        return;
      }
      const base = `http://${request.headers.host}`;
      const payload = documents.load(code) ?? {};
      const html = renderDocument(entry, payload, `${base}/verify/${entry.code}`);
      sendHtml(response, 200, html, request);
      return;
    }

    // ------------------------- verificación pública en HTML (persona)
    if (path.startsWith("/verify/") && request.method === "GET") {
      const code = decodeURIComponent(path.slice("/verify/".length));
      const report = await verifyCredential(relay, code);
      const base = `http://${request.headers.host}`;
      sendHtml(response, report.verified ? 200 : 404, renderVerificationPage(report, base), request);
      return;
    }

    sendJson(response, 404, { ok: false, error: "Ruta no encontrada." }, request);
  } catch (error) {
    sendJson(
      response,
      500,
      { ok: false, error: (error instanceof Error ? error.message : String(error)) },
      request,
    );
  }
});

publicKeyPem = loadSigner(config.signingKeyPath);

server.listen(config.port, () => {
  console.log(`Gateway UNAC escuchando en http://localhost:${config.port}`);
  console.log(`  relay:  ${relay.name}`);
  console.log(`  cadena: ${config.chainFile}`);
  console.log(`  llave:  ${config.signingKeyPath}`);
  if (!config.staffToken) {
    console.warn("  AVISO: STAFF_TOKEN no está configurado; las escrituras serán rechazadas.");
  }
});
