import type { ProgramChangeRequest, ProgramChangeStatus } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function listAllProgramChanges(): ProgramChangeRequest[] {
  return readList<ProgramChangeRequest>(STORAGE_KEYS.programChanges).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function listProgramChangesByStudent(studentId: string): ProgramChangeRequest[] {
  return listAllProgramChanges().filter((item) => item.studentId === studentId);
}

export function getLatestProgramChange(studentId: string): ProgramChangeRequest | undefined {
  return listProgramChangesByStudent(studentId)[0];
}

export function hasPendingProgramChange(studentId: string): boolean {
  return listProgramChangesByStudent(studentId).some(
    (item) => item.status === "Solicitada" || item.status === "En revisión",
  );
}

export interface CreateProgramChangeInput {
  studentId: string;
  studentEmail: string;
  studentName: string;
  currentProgramId: string;
  requestedProgramId: string;
  reason: string;
}

export function createProgramChangeRequest(input: CreateProgramChangeInput): ProgramChangeRequest {
  const request: ProgramChangeRequest = {
    id: generateId("PCR"),
    studentId: input.studentId,
    studentEmail: input.studentEmail,
    studentName: input.studentName,
    currentProgramId: input.currentProgramId,
    requestedProgramId: input.requestedProgramId,
    reason: input.reason.trim(),
    status: "Solicitada",
    createdAt: new Date().toISOString(),
  };
  const list = listAllProgramChanges();
  list.push(request);
  writeList(STORAGE_KEYS.programChanges, list);
  return request;
}

export function updateProgramChangeStatus(
  id: string,
  status: ProgramChangeStatus,
  reviewNote?: string,
): ProgramChangeRequest | undefined {
  const list = listAllProgramChanges();
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  const updated: ProgramChangeRequest = {
    ...list[idx],
    status,
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote?.trim() || list[idx].reviewNote,
  };
  list[idx] = updated;
  writeList(STORAGE_KEYS.programChanges, list);
  return updated;
}
