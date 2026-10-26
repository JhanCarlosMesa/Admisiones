import type { Notification, Role } from "../types";
import { generateId, readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export interface CreateNotificationInput {
  audience: string;
  title: string;
  body: string;
  type: Notification["type"];
  expiresAt?: string;
}

export function createNotification(input: CreateNotificationInput): Notification {
  const notification: Notification = {
    id: generateId("NOT"),
    audience: input.audience,
    title: input.title.trim(),
    body: input.body.trim(),
    type: input.type,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
  };
  const list = readList<Notification>(STORAGE_KEYS.notifications);
  list.push(notification);
  writeList(STORAGE_KEYS.notifications, list);
  return notification;
}

/** Avisa a una cuenta concreta. El `audience` es el id del usuario. */
export function notifyUser(
  accountId: string,
  title: string,
  body: string,
  type: Notification["type"],
): void {
  createNotification({ audience: accountId, title, body, type });
}

export function listActiveNotificationsFor(
  role: Role | "Aspirante" | "Estudiante" | "Staff" | "*",
  accountId?: string,
): Notification[] {
  const now = Date.now();
  return readList<Notification>(STORAGE_KEYS.notifications)
    .filter((n) => !n.expiresAt || Date.parse(n.expiresAt) > now)
    .filter(
      (n) =>
        n.audience === "*" ||
        n.audience === role ||
        (accountId !== undefined && n.audience === accountId),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Marca como leídas las notificaciones dirigidas a un usuario. */
export function markReadFor(audience: string): void {
  const list = readList<Notification>(STORAGE_KEYS.notifications);
  const now = new Date().toISOString();
  writeList(
    STORAGE_KEYS.notifications,
    list.map((n) => (n.audience === audience ? { ...n, readAt: now } : n)),
  );
}
