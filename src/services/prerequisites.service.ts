import type { ExternalPrerequisite, PrerequisiteStatus } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function listAllPrerequisites(): ExternalPrerequisite[] {
  return readList<ExternalPrerequisite>(STORAGE_KEYS.prerequisites).sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function listPrerequisitesByStudent(studentId: string): ExternalPrerequisite[] {
  return listAllPrerequisites().filter((item) => item.studentId === studentId);
}

export interface CreatePrerequisiteInput {
  studentId: string;
  studentEmail: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  institution: string;
  year: number;
  grade: number;
  notes?: string;
}

export function createPrerequisite(input: CreatePrerequisiteInput): ExternalPrerequisite {
  const record: ExternalPrerequisite = {
    id: generateId("PRR"),
    studentId: input.studentId,
    studentEmail: input.studentEmail,
    studentName: input.studentName,
    courseCode: input.courseCode.trim().toUpperCase(),
    courseName: input.courseName.trim(),
    institution: input.institution.trim(),
    year: input.year,
    grade: input.grade,
    notes: input.notes?.trim(),
    status: "Pendiente",
    createdAt: new Date().toISOString(),
  };
  const list = listAllPrerequisites();
  list.push(record);
  writeList(STORAGE_KEYS.prerequisites, list);
  return record;
}

export function updatePrerequisiteStatus(
  id: string,
  status: PrerequisiteStatus,
  reviewNote?: string,
): ExternalPrerequisite | undefined {
  const list = listAllPrerequisites();
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return undefined;
  const updated: ExternalPrerequisite = {
    ...list[idx],
    status,
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote?.trim() || list[idx].reviewNote,
  };
  list[idx] = updated;
  writeList(STORAGE_KEYS.prerequisites, list);
  return updated;
}
