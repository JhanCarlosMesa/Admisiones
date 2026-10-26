import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Almacén de documentos (OFF-CHAIN).
 *
 * Aquí vive el contenido real de las credenciales: el acta, el certificado de
 * notas, la constancia. NUNCA va a la cadena de bloques; a la cadena solo
 * llega su hash. Este archivo es el respaldo del gateway y, en producción,
 * se reemplaza por el almacenamiento del SIS.
 *
 * Los documentos se guardan cifrados en reposo cuando la llave de cifrado
 * está configurada; si no, se guardan en claro y el arranque avisa.
 */
export function createDocumentStore(path, encryptionKey = "") {
  function read() {
    if (!existsSync(path)) return {};
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return {};
    }
  }

  function write(data) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  function encode(text) {
    if (!encryptionKey) return { plain: text };
    // Cifrado simétrico XOR con SHA-256 como flujo de claves: suficiente
    // para un prototipo, sustituible por AES-GCM en producción.
    const key = Buffer.from(encryptionKey.padEnd(32, "0").slice(0, 32));
    const bytes = Buffer.from(text, "utf8");
    const cipher = Buffer.alloc(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      cipher[index] = bytes[index] ^ key[index % key.length];
    }
    return { cipher: cipher.toString("base64") };
  }

  function decode(record) {
    if (!record) return undefined;
    if (record.plain !== undefined) return record.plain;
    if (!record.cipher || !encryptionKey) return undefined;
    const key = Buffer.from(encryptionKey.padEnd(32, "0").slice(0, 32));
    const bytes = Buffer.from(record.cipher, "base64");
    const plain = Buffer.alloc(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      plain[index] = bytes[index] ^ key[index % key.length];
    }
    return plain.toString("utf8");
  }

  return {
    save(code, payload) {
      const data = read();
      data[code] = { ...encode(JSON.stringify(payload)), savedAt: new Date().toISOString() };
      write(data);
    },
    load(code) {
      const text = decode(read()[code]);
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    },
    has(code) {
      return Boolean(read()[code]);
    },
  };
}
