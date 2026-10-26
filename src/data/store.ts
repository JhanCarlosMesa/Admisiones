/**
 * Caché de las listas ya parseadas. Con cientos de estudiantes y matrículas
 * el JSON.parse se repite miles de veces por vista; aquí se parsea una sola vez
 * y se invalida al escribir.
 */
const cache = new Map<string, unknown>();

export function readList<T>(key: string): T[] {
  if (cache.has(key)) return [...(cache.get(key) as T[])];
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as T[]) : [];
    cache.set(key, list);
    return [...list];
  } catch {
    return [];
  }
}

export function writeList<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list));
  cache.set(key, list);
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
