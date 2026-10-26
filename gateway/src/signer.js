import { createPrivateKey, createPublicKey, sign, verify, generateKeyPairSync } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Firmante institucional.
 *
 * Usa Ed25519: firma rápida, determinista y con claves cortas. La llave
 * privada NUNCA sale del gateway; la pública se publica para que cualquiera
 * pueda validar las firmas.
 */
let privateKey = null;
let publicKeyPem = "";

export function loadSigner(path) {
  if (!existsSync(path)) {
    throw new Error(
      `No se encontró la llave de firma en ${path}. Ejecútalo con: npm run keys`,
    );
  }
  privateKey = createPrivateKey(readFileSync(path, "utf8"));
  publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  return publicKeyPem;
}

export function getPublicKey() {
  return publicKeyPem;
}

/** Firma el hash del documento. */
export function signHash(hash) {
  if (!privateKey) throw new Error("El firmante no está inicializado.");
  return sign(null, Buffer.from(hash, "hex"), privateKey).toString("base64");
}

/** Verifica una firma contra el hash. */
export function verifyHash(hash, signature, publicKey = publicKeyPem) {
  try {
    return verify(null, Buffer.from(hash, "hex"), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

/** Genera el par de llaves. La privada queda con permisos 0600. */
export function generateKeyPair(privatePath, publicPath) {
  const { privateKey: priv, publicKey: pub } = generateKeyPairSync("ed25519");
  mkdirSync(dirname(privatePath), { recursive: true });
  mkdirSync(dirname(publicPath), { recursive: true });
  writeFileSync(privatePath, priv.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(publicPath, pub.export({ type: "spki", format: "pem" }));
  return { privatePath, publicPath };
}
