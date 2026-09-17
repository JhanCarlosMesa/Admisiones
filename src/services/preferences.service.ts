import type { ThemePreferences } from "../types";
import { readList, writeList } from "../data/store";
import { STORAGE_KEYS } from "../data/keys";

const DEFAULT: ThemePreferences = { theme: "light" };

export function getPreferences(): ThemePreferences {
  const list = readList<ThemePreferences>(STORAGE_KEYS.preferences);
  return list[0] ?? DEFAULT;
}

export function setTheme(theme: "light" | "dark"): ThemePreferences {
  const prefs: ThemePreferences = { theme };
  writeList(STORAGE_KEYS.preferences, [prefs]);
  applyTheme(theme);
  return prefs;
}

export function toggleTheme(): ThemePreferences {
  const current = getPreferences().theme;
  return setTheme(current === "dark" ? "light" : "dark");
}

export function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
}

export function initTheme(): void {
  const stored = getPreferences().theme;
  applyTheme(stored);
}
