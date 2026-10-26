import type { AnchorAudit } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

/**
 * Bitácora de acciones de anclaje. Cada emisión queda registrada con su
 * actor, su resultado y su fecha, de modo que el proceso de emisión de una
 * credencial se puede reconstruir sin depender de la base de datos.
 */
export function recordAudit(
  credentialId: string,
  action: AnchorAudit["action"],
  actor: string,
  detail: string,
): AnchorAudit {
  const entry: AnchorAudit = {
    id: generateId("AUD"),
    credentialId,
    action,
    actor,
    detail,
    createdAt: new Date().toISOString(),
  };
  const list = readList<AnchorAudit>(STORAGE_KEYS.anchorAudit);
  list.push(entry);
  writeList(STORAGE_KEYS.anchorAudit, list);
  return entry;
}

export function listAuditFor(credentialId: string): AnchorAudit[] {
  return readList<AnchorAudit>(STORAGE_KEYS.anchorAudit)
    .filter((item) => item.credentialId === credentialId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listAllAudit(): AnchorAudit[] {
  return readList<AnchorAudit>(STORAGE_KEYS.anchorAudit).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}
