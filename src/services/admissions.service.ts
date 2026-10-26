import type { Account, AdmissionApplication, AdmissionStatus } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";
import { promoteToStudent } from "./auth.service";
import { createNotification, notifyUser } from "./notifications.service";

function getAll(): AdmissionApplication[] {
  return readList<AdmissionApplication>(STORAGE_KEYS.admissions);
}

function saveAll(list: AdmissionApplication[]): void {
  writeList(STORAGE_KEYS.admissions, list);
}

export function listByApplicant(accountId: string): AdmissionApplication[] {
  return getAll()
    .filter((item) => item.applicantId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAll(): AdmissionApplication[] {
  return getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hasActiveApplication(accountId: string): boolean {
  return getAll().some((item) => item.applicantId === accountId && item.status !== "Rechazado");
}

export function submitApplication(
  account: Account,
  input: { programId: string; level: string; city: string; modality: string; motivation: string },
): { ok: true } | { ok: false; message: string } {
  if (hasActiveApplication(account.id)) {
    return { ok: false, message: "Ya tienes una solicitud activa en proceso." };
  }
  const application: AdmissionApplication = {
    id: generateId("ADM"),
    applicantId: account.id,
    applicantEmail: account.email,
    programId: input.programId,
    level: input.level,
    city: input.city,
    modality: input.modality,
    motivation: input.motivation,
    status: "Radicada",
    createdAt: new Date().toISOString(),
  };
  saveAll([...getAll(), application]);

  // Avisamos al equipo de admisiones que hay una solicitud nueva por revisar.
  createNotification({
    audience: "Staff",
    title: "Nueva solicitud de admisión",
    body: `${account.firstName} ${account.lastName} radicó una solicitud. Ya está disponible en el panel de admisiones.`,
    type: "info",
  });

  return { ok: true };
}

export function markUnderReview(id: string): void {
  const list = getAll();
  const application = list.find((item) => item.id === id);
  if (!application) return;
  saveAll(
    list.map((item) =>
      item.id === id ? { ...item, status: "En revisión" as AdmissionStatus } : item,
    ),
  );
  notifyUser(
    application.applicantId,
    "Tu solicitud está en revisión",
    "El equipo de admisiones ya está evaluando tu solicitud. Te avisaremos cuando haya una decisión.",
    "info",
  );
}

export function decide(id: string, decision: "Admitido" | "Rechazado", note: string): void {
  const list = getAll();
  const application = list.find((item) => item.id === id);
  if (!application) return;
  saveAll(
    list.map((item) =>
      item.id === id
        ? { ...item, status: decision, reviewedAt: new Date().toISOString(), reviewNote: note }
        : item,
    ),
  );

  if (decision === "Admitido") {
    promoteToStudent(application.applicantId);
    notifyUser(
      application.applicantId,
      "¡Felicitaciones! Fuiste admitido",
      `Tu solicitud fue aprobada. Ya tienes rol de Estudiante y puedes matricular materias. ${note}`,
      "success",
    );
  } else {
    notifyUser(
      application.applicantId,
      "Tu solicitud no fue aprobada",
      `Puedes consultar el motivo en el seguimiento de tu solicitud. ${note}`,
      "danger",
    );
  }
}
