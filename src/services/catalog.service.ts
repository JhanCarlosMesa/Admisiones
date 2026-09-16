import type { Course, CourseOffering, Period, Program } from "../types";
import { readList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function getPrograms(): Program[] {
  return readList<Program>(STORAGE_KEYS.programs);
}

export function getProgram(id: string): Program | undefined {
  return getPrograms().find((item) => item.id === id);
}

export function getCoursesByProgram(programId: string): Course[] {
  return readList<Course>(STORAGE_KEYS.courses)
    .filter((item) => item.programId === programId)
    .sort((a, b) => a.semester - b.semester);
}

export function getCourse(id: string): Course | undefined {
  return readList<Course>(STORAGE_KEYS.courses).find((item) => item.id === id);
}

export function getPeriods(): Period[] {
  return readList<Period>(STORAGE_KEYS.periods);
}

export function getActivePeriod(): Period | undefined {
  return getPeriods().find((item) => item.active);
}

export function getPeriod(id: string): Period | undefined {
  return getPeriods().find((item) => item.id === id);
}

export function getOfferingsByPeriod(periodId: string): CourseOffering[] {
  return readList<CourseOffering>(STORAGE_KEYS.offerings).filter((item) => item.periodId === periodId);
}

export function getOffering(id: string): CourseOffering | undefined {
  return readList<CourseOffering>(STORAGE_KEYS.offerings).find((item) => item.id === id);
}
