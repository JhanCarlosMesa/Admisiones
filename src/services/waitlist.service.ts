import type { WaitlistEntry } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

function getAll(): WaitlistEntry[] {
  return readList<WaitlistEntry>(STORAGE_KEYS.waitlist);
}

function saveAll(list: WaitlistEntry[]): void {
  writeList(STORAGE_KEYS.waitlist, list);
}

/** Espera de una oferta, en orden de llegada. */
export function listByOffering(offeringId: string): WaitlistEntry[] {
  return getAll()
    .filter((item) => item.offeringId === offeringId && item.status === "En espera")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Espera propia del estudiante, en todas las ofertas. */
export function listByStudent(studentId: string): WaitlistEntry[] {
  return getAll()
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isOnWaitlist(studentId: string, offeringId: string): boolean {
  return getAll().some(
    (item) =>
      item.studentId === studentId &&
      item.offeringId === offeringId &&
      item.status === "En espera",
  );
}

export function positionInWaitlist(entryId: string): number {
  const entry = getAll().find((item) => item.id === entryId);
  if (!entry) return 0;
  return listByOffering(entry.offeringId).findIndex((item) => item.id === entryId) + 1;
}

export function joinWaitlist(input: {
  studentId: string;
  studentEmail: string;
  studentName: string;
  offeringId: string;
}): { ok: true; position: number } | { ok: false; message: string } {
  if (isOnWaitlist(input.studentId, input.offeringId)) {
    return { ok: false, message: "Ya estás en la lista de espera de esta materia." };
  }
  const entry: WaitlistEntry = {
    id: generateId("WTL"),
    studentId: input.studentId,
    studentEmail: input.studentEmail,
    studentName: input.studentName,
    offeringId: input.offeringId,
    createdAt: new Date().toISOString(),
    status: "En espera",
  };
  saveAll([...getAll(), entry]);
  return { ok: true, position: positionInWaitlist(entry.id) };
}

export function leaveWaitlist(entryId: string): void {
  saveAll(
    getAll().map((item) =>
      item.id === entryId ? { ...item, status: "Cancelado" as const } : item,
    ),
  );
}

export function markPromoted(entryId: string): void {
  saveAll(
    getAll().map((item) =>
      item.id === entryId ? { ...item, status: "Promovido" as const } : item,
    ),
  );
}

/** Saca al primer estudiante de la espera de una oferta y lo devuelve. */
export function nextInLine(offeringId: string): WaitlistEntry | undefined {
  return listByOffering(offeringId)[0];
}
