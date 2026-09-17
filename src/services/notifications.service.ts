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

export function listActiveNotificationsFor(role: Role | "Aspirante" | "Estudiante" | "Staff" | "*"): Notification[] {
  const now = Date.now();
  return readList<Notification>(STORAGE_KEYS.notifications)
    .filter((n) => !n.expiresAt || Date.parse(n.expiresAt) > now)
    .filter((n) => n.audience === "*" || n.audience === role)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
