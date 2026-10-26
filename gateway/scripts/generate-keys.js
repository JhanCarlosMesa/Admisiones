import { generateKeyPair } from "../src/signer.js";
import { resolve } from "node:path";
import { config } from "../src/config.js";

/**
 * Genera el par de llaves de firma institucional.
 *   npm run keys
 *
 * La llave privada queda con permisos 0600 y NUNCA se sube al repositorio.
 * La pública sí se publica: es lo que permite validar las firmas.
 */
const publicPath = config.signingKeyPath.replace(/\.pem$/, ".pub.pem");
const { privatePath, publicPath: pub } = generateKeyPair(config.signingKeyPath, publicPath);

console.log("Llaves generadas:");
console.log(`  privada: ${privatePath}  (permisos 0600, no la subas al repositorio)`);
console.log(`  publica: ${pub}`);
console.log("");
console.log("Copia la pública en el .env o publícala en /api/v1/public-key del gateway.");
