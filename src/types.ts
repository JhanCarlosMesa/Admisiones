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

export type CourseType = "Obligatoria" | "Electiva" | "Práctica" | "Trabajo de grado" | "Cátedra";

export interface Course {
  id: string;
  programId: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  hours: number;
  semester: number;
  type: CourseType;
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

export type ProgramChangeStatus = "Solicitada" | "En revisión" | "Aprobada" | "Rechazada";

export interface ProgramChangeRequest {
  id: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  currentProgramId: string;
  requestedProgramId: string;
  reason: string;
  status: ProgramChangeStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export type PrerequisiteStatus = "Pendiente" | "Aprobada" | "Rechazada";

export interface ExternalPrerequisite {
  id: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  courseCode: string;
  courseName: string;
  institution: string;
  year: number;
  grade: number;
  status: PrerequisiteStatus;
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export type NotificationType = "info" | "warning" | "success" | "danger";

export interface Notification {
  id: string;
  audience: string; // role or user id; "*" = everyone
  title: string;
  body: string;
  type: NotificationType;
  createdAt: string;
  expiresAt?: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  type: "Charla" | "Feria" | "Tour" | "Webinar" | "Open Day";
  date: string; // ISO
  location: string;
  speaker?: string;
  capacity: number;
  enrolled: number;
}

export interface Testimonial {
  id: string;
  name: string;
  programId: string;
  graduationYear: number;
  currentRole: string;
  company: string;
  quote: string;
  initials: string; // for the avatar circle
}

export interface FaqItem {
  id: string;
  category: "Admisiones" | "Matrícula" | "Pagos" | "Vida universitaria" | "Académico";
  question: string;
  answer: string;
}

export interface ThemePreferences {
  theme: "light" | "dark";
}
