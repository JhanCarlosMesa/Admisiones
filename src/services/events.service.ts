import type { CampusEvent } from "../types";
import { readList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

export function listAllEvents(): CampusEvent[] {
  return readList<CampusEvent>(STORAGE_KEYS.events).sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
}

export function listUpcomingEvents(limit?: number): CampusEvent[] {
  const now = Date.now();
  return listAllEvents()
    .filter((e) => Date.parse(e.date) >= now)
    .slice(0, limit);
}

export function enrollInEvent(eventId: string): CampusEvent | undefined {
  // Simulated increment — in a real app this would persist to a separate collection
  // For the demo we just increment in-memory; if persistence is needed, use a Map in localStorage.
  const events = listAllEvents();
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) return undefined;
  const ev = events[idx];
  if (ev.enrolled >= ev.capacity) return ev;
  events[idx] = { ...ev, enrolled: ev.enrolled + 1 };
  localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events));
  return events[idx];
}
