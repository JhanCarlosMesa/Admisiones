import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { GENESIS_HASH } from "./config.js";

/**
 * Relay de la cadena.
 *
 * Dos implementaciones del mismo contrato:
 *
 *  - "file": los anclajes se guardan en un archivo JSONL encadenado. Cada
 *    anclaje incluye el hash del anterior, así que alterar una línea antigua
 *    rompe la cadena y se detecta. Es el modo por defecto y no necesita
 *    infraestructura.
 *
 *  - "network": delega la escritura en un relay externo (por ejemplo el
 *    gateway REST de Hyperledger Fabric o un contrato en Polygon Edge).
 *
 * Lo que cambia entre ambos es DÓNDE se escribe; el hashing, la firma y la
 * verificación son los mismos.
 */

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function anchorHash(entry) {
  return sha256(`${entry.payloadHash}|${entry.signedAt}|${entry.signature}|${entry.previousHash}`);
}

function readChain(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function appendChain(file, entry) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

/** Relay sobre archivo local encadenado. */
export const fileRelay = {
  name: "file",
  async write({ type, code, reference, programId, periodId, payloadHash, signature, signedAt }) {
    const chain = readChain(this.file);
    const previous = chain.length > 0 ? chain[chain.length - 1] : undefined;
    const previousHash = previous ? anchorHash(previous) : GENESIS_HASH;
    const entry = {
      id: randomUUID(),
      type,
      code,
      reference,
      programId: programId ?? null,
      periodId: periodId ?? null,
      payloadHash,
      previousHash,
      signedAt,
      signature,
    };
    entry.anchorHash = anchorHash(entry);
    appendChain(this.file, entry);
    return entry;
  },
  async findByCode(code) {
    const chain = readChain(this.file);
    const normalized = code.trim().toUpperCase();
    return chain.find((item) => item.code.toUpperCase() === normalized);
  },
  async list() {
    return readChain(this.file);
  },
  async verifyChain() {
    const chain = readChain(this.file);
    let previousHash = GENESIS_HASH;
    for (const entry of chain) {
      if (entry.previousHash !== previousHash) {
        return { ok: false, brokenAt: entry.id, detail: "El encadenamiento no coincide." };
      }
      if (anchorHash(entry) !== entry.anchorHash) {
        return { ok: false, brokenAt: entry.id, detail: "El anclaje fue alterado." };
      }
      previousHash = entry.anchorHash;
    }
    return { ok: true, length: chain.length };
  },
};

/**
 * Relay externo. Escribe en el ledgerPermissioned de la red configurada y
 * lee de él. La implementación concreta depende de la red elegida; el
 * contrato es el mismo.
 */
export const networkRelay = {
  name: "network",
  async write(entry) {
    const response = await fetch(`${this.url}/api/v1/anchors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      throw new Error(`El relay respondió ${response.status}.`);
    }
    return response.json();
  },
  async findByCode(code) {
    const response = await fetch(`${this.url}/api/v1/anchors/${encodeURIComponent(code)}`);
    if (!response.ok) return undefined;
    return response.json();
  },
  async list() {
    const response = await fetch(`${this.url}/api/v1/anchors`);
    return response.json();
  },
};

export function getRelay(config) {
  if (config.relay === "network") {
    if (!config.relayUrl) {
      throw new Error("RELAY=network requiere configurar RELAY_URL.");
    }
    return { ...networkRelay, url: config.relayUrl };
  }
  return { ...fileRelay, file: config.chainFile };
}
