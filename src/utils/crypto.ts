function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toHex(bytes.buffer);
}

export function randomSalt(): string {
  return randomHex(16);
}

export function randomToken(): string {
  return randomHex(24);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/**
 * Serialización canónica: el mismo objeto produce siempre el mismo texto.
 * Las claves se ordenan alfabéticamente para que el orden de inserción del
 * objeto no altere el hash. Sin esto, dos sistemas que construyan el mismo
 * documento en distinto orden obtendrían hashes distintos y la verificación
 * fallaría sin explicación.
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
 * Hash con dominio ("UNAC|v1|"). El prefijo impide que alguien con un
 * documento corto adivine su hash por fuerza bruta (ataque de preimagen).
 */
export async function hashPayload(payload: unknown): Promise<string> {
  return sha256Hex(`UNAC|v1|${canonicalJson(payload)}`);
}
