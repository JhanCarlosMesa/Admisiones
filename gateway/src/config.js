import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Configuración del gateway. Todo viene de variables de entorno para que
 * ningún secreto quede en el repositorio.
 */
function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

export const config = {
  port: Number(env("PORT", "3080")),
  /** "file" (anclajes en un archivo encadenado) o "network" (relay externo). */
  relay: env("RELAY", "file"),
  /** URL del relay de red, cuando RELAY=network. */
  relayUrl: env("RELAY_URL", ""),
  /** Ruta de la llave privada de firma institucional. */
  signingKeyPath: resolve(env("SIGNING_KEY_PATH", "./keys/unac-signing-key.pem")),
  /** Ruta del archivo donde se registran los anclajes. */
  chainFile: resolve(env("CHAIN_FILE", "./data/anchors.jsonl")),
  /**
   * Token compartido para las operaciones de escritura.
   *
   * ATENCIÓN: es un compromiso de proyecto de clase. El token viaja en el
   * bundle del navegador, así que cualquiera que abra las herramientas de
   * desarrollo puede leerlo. En producción debe sustituirse por OAuth 2.0
   * con PKCE contra el IdP institucional.
   */
  staffToken: env("STAFF_TOKEN", ""),
  /** Orígenes permitidos para el navegador del portal. */
  allowedOrigins: env("ALLOWED_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
};

export const GENESIS_HASH = "0".repeat(64);
