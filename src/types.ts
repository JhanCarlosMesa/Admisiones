export type Role = "Aspirante" | "Estudiante" | "Staff";

export interface Account {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
  role: Role;
  createdAt: string;
}

export interface Session {
  accountId: string;
  email: string;
  role: Role;
  expiresAt: number;
}

export interface RecoveryToken {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

export type AdmissionStatus = "Radicada" | "En revisión" | "Admitido" | "Rechazado";

export interface AdmissionApplication {
  id: string;
  applicantId: string;
  applicantEmail: string;
  programId: string;
  level: string;
  city: string;
  modality: string;
  motivation: string;
  status: AdmissionStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface Program {
  id: string;
  name: string;
  level: string;
  duration: string;
  modality: string;
  description: string;
  colorClass: string;
}

export interface Course {
  id: string;
  programId: string;
  name: string;
  credits: number;
  semester: number;
}

export interface CourseOffering {
  id: string;
  courseId: string;
  periodId: string;
  day: string;
  startTime: string;
  endTime: string;
  capacity: number;
  professor: string;
}

export interface Period {
  id: string;
  name: string;
  active: boolean;
}

export type EnrollmentStatus = "Matriculada" | "Cancelada";

export interface Enrollment {
  id: string;
  studentId: string;
  offeringId: string;
  periodId: string;
  status: EnrollmentStatus;
  createdAt: string;
}
